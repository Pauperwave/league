# Route Map

<!-- docs/architecture/routes.md -->

Complete inventory of all application routes.

## Public Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/` | `pages/index.vue` | App root — navigation hub to leagues, players, decks, rulesets | None |
| `/login` | `pages/login.vue` | Authentication page | Supabase auth |

---

## League Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/leagues` | `pages/leagues/index.vue` | List all leagues | `useLeagues()` |
| `/league/:id` | `pages/league/[id].vue` | League detail + tournament list + cross-tournament standings | `useLeague(id)`, `useEvents(leagueId)` |
| `/league/:leagueId/tournament/:tournamentId` | `pages/league/[leagueId]/tournament/[tournamentId].vue` | Tournament management page (registration, playing, ended) | `useTournamentPage()` |

### Tournament Page URL Query Params

The tournament page supports query parameters for modal state persistence:

| Param | Example | Purpose |
|-------|---------|---------|
| `phase` | `?phase=playing` | Override current phase |
| `round` | `?round=1` | Override current round |
| `preview` | `?preview=1` | Open table preview modal |
| `scoreModal` | `?scoreModal=1` | Open score modal |
| `killModal` | `?killModal=1` | Open kill system modal |
| `votesModal` | `?votesModal=1` | Open votes modal |
| `commanderModal` | `?commanderModal=1` | Open commander modal |

See `docs/architecture/modal-url-sync.md` for full documentation.

---

## Player Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/players` | `pages/players/index.vue` | List all players with search + deck filter | `usePlayers()`, `useCommanderDecks()` |
| `/player/:slug` | `pages/player/[slug]/index.vue` | Player profile + stats + commander decks | `usePlayerStats(playerId)`, `useCommanderDecks(playerId)` |
| `/player/:slug/deck/:deckSlug` | `pages/player/[slug]/deck/[deckSlug].vue` | Player-specific deck statistics | `useDeckStats(playerId, commander1, commander2)` |

> **Note:** Slug is computed from `slugify("{name} {surname}")`. Example: `/player/alessandro-berti`.

---

## Deck Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/decks` | `pages/decks/index.vue` | Browse all unique commanders (deduplicated) | `useCommanderDecks()`, `useCommanderAggregates()` |
| `/deck/:deckSlug` | `pages/deck/[deckSlug].vue` | Global commander stats across all players | `useCommanderStats(commander1, commander2?)` |

> **Player-specific vs global:**
> - `/player/:slug/deck/:deckSlug` → "How this player performs with this commander"
> - `/deck/:deckSlug` → "How all players perform with this commander"

---

## Commander Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/commanders` | `pages/commanders/index.vue` | Sortable browse list of every distinct commander name (card-level, not deck-pair) | `useAllCommanderStats()`, `useCommanderCatalogQuery()` |
| `/commander/:commanderSlug` | `pages/commander/[commanderSlug].vue` | Single-commander page: art, win-rate chart, decks featuring it | `useDecksQuery()`, `usePlayersQuery()`, `useCommanderCards()`, `useSingleCommanderStats()` |

> **Commander vs deck routes:** `/deck/:deckSlug` is about a *pair* (`commander_1` + optional `commander_2`, as actually played together); `/commander/:commanderSlug` is about one *card*, aggregated across every pair it has appeared in on either side (see `useCommanderAggregate.ts`'s known `playerCount` double-count caveat, BACKLOG #10).

---

## Ruleset Routes

| Route | File | Description | Key Data |
|-------|------|-------------|----------|
| `/rulesets` | `pages/rulesets.vue` | List all rulesets | `useRulesets()` |

---

## Route Relationships

```
/                           (root hub)
├── /leagues                (list)
│   └── /league/:id         (detail)
│       └── /league/:leagueId/tournament/:tournamentId  (tournament page)
│
├── /players                (list)
│   └── /player/:slug       (profile)
│       └── /player/:slug/deck/:deckSlug      (player deck stats)
│
├── /decks                  (browse all)
│   └── /deck/:deckSlug     (global commander stats)
│
├── /commanders             (browse all, card-level)
│   └── /commander/:commanderSlug  (single-commander page)
│
├── /rulesets               (list)
│
└── /login                  (auth)
```

---

## Nested Route Gotchas

Nuxt file-based routing creates **parent-child relationships** when a directory and file share a path segment:

```
pages/player/[slug].vue        ← parent (requires <NuxtPage>)
pages/player/[slug]/index.vue   ← child
pages/player/[slug]/deck/[deckSlug].vue  ← child
```

**Problem:** If `player/[slug].vue` exists as a file, it becomes a parent route. The child pages only render if the parent contains `<NuxtPage>`.

**Solution:** Move the parent content to `player/[slug]/index.vue` and delete `player/[slug].vue`. This makes all three routes **independent**.

See the player profile refactor in git history for the full context.

### Why the league detail page is `[id].vue`, not `[leagueId].vue` (deliberate — don't "fix" it)

The league routes solve the same problem with the *other* available trick: a **mismatched param name**. Per the [Nuxt pages docs](https://nuxt.com/docs/4.x/directory-structure/app/pages), *"named parent routes will take priority over nested dynamic routes"* — translated to this repo:

```
pages/league/[leagueId].vue                    ← if it existed, it would pair with…
pages/league/[leagueId]/tournament/[tournamentId].vue    ← …this folder as parent → child
```

For `/league/7/tournament/12`, `league/[leagueId].vue` would take priority over `league/[leagueId]/tournament/[tournamentId].vue` — the **league page would render instead of the tournament page**, unless the league page embedded `<NuxtPage>`. Naming the file `league/[id].vue` breaks the file/folder pairing, so `/league/7` (league detail) and `/league/7/tournament/12` (tournament page) stay flat, independent routes. There's a matching warning comment at the top of `app/pages/league/[id].vue`.

(The `index.vue` solution used for the player routes above would work here too — `league/[leagueId]/index.vue` — but the `[id]` rename predates it and works; pick either pattern for future cases, just never a same-named file + folder without `<NuxtPage>`.)

---

## Dynamic Parameters

| Param | Type | Source | Example |
|-------|------|--------|---------|
| `:id` | `number` | Route params | `/league/150` → `id = 150` |
| `:leagueId` | `number` | Route params | `/league/150/tournament/227` → `leagueId = 150` |
| `:tournamentId` | `number` | Route params | `tournamentId = 227` |
| `:slug` | `string` | Route params | `/player/alessandro-berti` → `slug = "alessandro-berti"` |
| `:deckSlug` | `string` | Route params | `/deck/ellie-vengeful-hunter` → `deckSlug = "ellie-vengeful-hunter"` |
| `:commanderSlug` | `string` | Route params | `/commander/atraxa-grand-unifier` → `commanderSlug = "atraxa-grand-unifier"` |

All numeric params are parsed via `parseInt()` in composables.

---

## Navigation Patterns

### Internal Links

- **Player names** → `PlayerNameTag` links to `/player/:slug`
- **Deck stats button** → `CommanderDeckCard` links to:
  - From player profile: `/player/:slug/deck/:deckSlug`
  - From `/decks` browse: `/deck/:deckSlug`
- **Tournament links** → `LeagueEventsPanel` links to `/league/:leagueId/tournament/:tournamentId`
- **League links** → `LeagueTable` links to `/league/:id`
- **Commander name links** → `/commanders` table and deck pages link to `/commander/:commanderSlug`

### Programmatic Navigation

- `navigateTo({ path, query })` — preferred for URL construction with params
- `router.push()` — used in `useTournamentUrl.ts` for query sync

---

## Related Docs

- `docs/architecture/component-hierarchy.md` — Which components render on each route
- `docs/architecture/event-flow.md` — Tournament page state transitions
- `docs/architecture/modal-url-sync.md` — Query parameter behavior
