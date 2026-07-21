# Commander partner/background whitelists

<!-- docs/architecture/commander-whitelists.md -->

How `CommanderModal.vue` decides which cards are legal as a player's **second** commander — partner mechanics (Partner, Partner With, Friends Forever, Doctor's Companion, Companion) and Backgrounds (Choose a Background). Three files do the actual work, all in `app/composables/commanders/`:

```
useCommanderCatalogQuery.ts   fetch + cache the whole mtg_commanders table (once)
        │
        ▼
useCommanderWhitelists.ts     derive per-partner-type name lists + lookups from the catalog
        │
        ▼
useCommanderSearch.ts         filter the catalog client-side per keystroke, using a whitelist
        │
        ▼
CommanderModal.vue            wires commander1's type to commander2's whitelist
```

## 1. The catalog: one fetch, cached for a month

`useCommanderCatalogQuery()` is a Pinia Colada query (ADR-015) that fetches **every row** of `mtg_commanders` (~2986 rows) via the `get_commander_catalog()` Postgres RPC, not a plain `supabase.from('mtg_commanders').select(...)`.

**Why an RPC instead of a plain select:** PostgREST caps a single request at 1000 rows regardless of table size. A plain `select()` here silently truncated the result to (whatever) 1000 rows Postgres happened to return first — this broke Background-commander detection for ~2000 cards in production (see `docs/PROGRESS.md` ADR-016) because many Backgrounds sorted past row 1000. `get_commander_catalog()` (`supabase/migrations/20260721000000_add_commander_catalog_rpc.sql`) wraps the whole result in `json_agg(row_to_json(t))`, so PostgREST sees exactly **one** JSON row in the response — the 1000-row cap never applies. See `docs/architecture/database.md`'s "RPC Functions" section for the general pattern.

**Why it's cached for 30 days, not the default 5 seconds:** the catalog only changes after a Scryfall resync or a manual DB correction — there's no reason to refetch it on every commander-modal open. `CATALOG_CACHE_TIME` (30 days) is used for both `staleTime` and `gcTime` — both matter, not just `staleTime`: the `@pinia/colada-plugin-cache-persister` plugin (see `docs/architecture/client-caching.md`) only persists what's still in Colada's in-memory cache, so a short `gcTime` would silently evict the entry (and therefore what gets persisted) well before the month is up, even with `staleTime` set correctly.

A manual refresh button in `CommanderModal.vue` (`onRefreshCatalog` → `refetch()`) exists specifically because the cache is long-lived enough that a real catalog update wouldn't otherwise surface for up to a month.

## 2. Deriving the whitelists

`useCommanderWhitelists()` takes the catalog (a flat array of `CommanderCatalogRow`) and, via a single `computed()`, buckets every card by its `partnerType` into named arrays:

| Array | `partner_type` value(s) | Meaning |
|-------|------------------------|---------|
| `commander` | (all rows) | Every card, regardless of type — the master list a first commander is picked from |
| `partner` | `'partner'` | Has plain Partner |
| `partnerWith` | `'partner_with'` | Has "Partner with \<specific card\>" |
| `background` | `'background'` | Is an actual Background enchantment (e.g. "Candlekeep Sage") |
| `backgroundCommander` | `'background_commander'` | A legendary creature with "Choose a Background" (e.g. "Abdel Adrian, Gorion's Ward") |
| `doctorsCompanion` | `'doctors_companion'` | Companion mechanic, Doctor Who-specific |
| `companion` | *(derived from `keywords`, not `partner_type`)* | Any card whose Scryfall `keywords` include `"Companion"` |
| `friendForever` | `'friends_forever'` | Has Friends Forever |

Two lookup maps are built alongside the buckets:
- `partnerTypeByName: Map<name, partnerType>` — `getPartnerType(name)` reads this, defaulting to `'commander'` for a card with no special mechanic.
- `partnerWithMap: Map<name, scryfallId>` — the specific card a `partner_with` commander is restricted to (not currently narrowed in `getAllowedPartners`, see "Known gaps" below).

### `getAllowedPartners(commander1Name)` — the bidirectional Background split

This is the function `CommanderModal.vue` actually calls to build commander2's whitelist. It switches on commander1's `partner_type`:

```ts
switch (type) {
  case 'partner':            return [...whitelists.value.partner]
  case 'partner_with':       return [...whitelists.value.partnerWith]
  case 'background_commander': return [...whitelists.value.background]        // needs an actual Background
  case 'background':           return [...whitelists.value.backgroundCommander] // needs a background-choosing creature
  case 'friends_forever':    return [...whitelists.value.friendForever]
  case 'doctors_companion':  return [...whitelists.value.doctorsCompanion]
  case 'companion':          return [...whitelists.value.companion]
  case 'commander': default: return []
}
```

**Why `background`/`background_commander` are two separate arrays, read in opposite directions:** this was a real bug (found and fixed 2026-07-21, see `docs/PROGRESS.md` ADR-016 discussion). Real Commander rules say a "Choose a Background" creature can only pair with an actual Background *enchantment* — never with another "Choose a Background" creature. An earlier version of this code merged both `partner_type`s into one `background` array and returned that same array for either direction, which meant two background-choosing creatures (e.g. "Jaheira, Friend of the Forest" and "Abdel Adrian, Gorion's Ward") could be incorrectly offered as partners for each other. Keeping them in separate arrays and swapping which one is returned per direction enforces the real rule structurally, not just by convention.

## 3. Filtering the search box — client-side, not per-keystroke queries

`useCommanderSearch(options)` used to run a `supabase.from('mtg_commanders').ilike(...)` query on every keystroke. It now filters the already-cached catalog in memory:

```ts
const whitelist = toValue(options.whitelist)
const whitelistSet = whitelist && whitelist.length > 0 ? new Set(whitelist) : null

let result = (catalog.value ?? []).filter((row) => {
  if (whitelistSet && !whitelistSet.has(row.name)) return false
  if (trimmed.length >= 1 && !row.name.toLowerCase().includes(trimmed)) return false
  return true
})
```

`options.whitelist`/`options.playerId` are typed as `MaybeRefOrGetter<...>`, read via `toValue()` inside `fetchSuggestions` — **not** captured as plain values at call time. This matters because the *second* commander's `CommanderSearch` instance doesn't unmount when `commander1` changes (only its text value resets via `CommanderModal.vue`'s `watch(() => props.commander1, ...)`); a plain captured value would go stale after the first commander1 selection, silently filtering by the wrong whitelist for every subsequent one. This was also a real, fixed bug (2026-07-21) — `CommanderSearch.vue` passes getters (`() => props.whitelist`) specifically so `useCommanderSearch` always reads the current prop.

`playerId`, when provided, reorders results (commanders that player has already used first, then by `edhrecRank`) via a real query against `round_results` — this one genuinely needs a DB round-trip per player, since usage history isn't part of the cached catalog.

## 4. Wiring in `CommanderModal.vue`

```
commander1 (typed by the user)
   │
   ▼
getPartnerType(commander1) ──► commander1PartnerType
   │
   ├─► canHaveCommander2 = type !== null && type !== 'commander'
   │
   └─► commander2Whitelist = getAllowedPartners(commander1)
            │
            ▼
   <CommanderSearch v-model="commander2" :whitelist="commander2Whitelist" />
```

`commander2Label` maps `commander1PartnerType` to a human-readable Italian label (`commander.partnerTypes.*` in `i18n/locales/it.json`) — e.g. "Background" for either `background` or `background_commander`, since the *label* doesn't need the direction split that `getAllowedPartners` does.

## Known gaps (not bugs, just unhandled cases)

- **`partner_group` and `doctor`** are valid `partner_type` values per the Valibot schema in `useCommanderCards.ts` (`PartnerTypeSchema`), but `useCommanderWhitelists.ts`'s bucketing `switch` and `getAllowedPartners`'s `switch` have no case for either. A card with one of these types would report `canHaveCommander2 = true` (since its type isn't `'commander'`) but `getAllowedPartners` falls through to the `default: return []` case — the commander2 search box would render enabled but show zero results. Whether these types are actually populated in `mtg_commanders` today hasn't been checked; flagging here so a future "why is commander2 empty for this card" report doesn't have to re-derive this.
- **`partner_with`** doesn't narrow to the *specific* partner card — `getAllowedPartners('partner_with')` returns the entire `partnerWith` bucket (every card with a "Partner with" ability), not just the one named card. `partnerWithMap` (name → the specific Scryfall ID) exists and is populated but isn't consulted here. Noted in the code as "could be narrowed in the future."

## Related docs

- `docs/architecture/client-caching.md` — the Colada cache-persister mechanism the catalog query relies on, and why it's not merged with the app's other localStorage helper.
- `docs/architecture/database.md` — the `get_commander_catalog()` RPC and the general "1000-row cap" pattern for any future table that needs a full unpaginated client read.
- `docs/architecture/async-data-keys.md` — the `['commander-catalog']` Colada key's entry in the full key inventory.
- `docs/PROGRESS.md` ADR-016 — the session this was built/fixed in, including the live-data correction of 31 commanders that had `partner_type IS NULL` despite having the "Choose a Background" keyword.
