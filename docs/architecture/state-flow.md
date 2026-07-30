# State Flow

<!-- docs/architecture/state-flow.md -->

How data moves through the application: **Database ↔ Colada query/mutation composables (or the two remaining Pinia stores) → page composable → Vue component.**

**Reads and writes take different paths (ADR-013/ADR-015):**
- **Reads** go client → Supabase directly, using the `anon` key (RLS `SELECT`-only policies).
- **Writes** always go through a `server/api/*` BFF endpoint using the service-role key, which bypasses RLS entirely. **No component or composable ever calls `supabase.from(...).insert/update/delete(...)`** — if you see that in `app/`, it's a regression.

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │◀───▶│  Colada query/mutation   │────▶│  Page composable │────▶│   Vue component │
│   (Supabase)    │     │  OR Pinia store          │     │  (orchestration) │     │   (UI)          │
└─────────────────┘     └─────────────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                                │                       │
        │                reads: client → Supabase (anon)         │                       │
        │                writes: $fetch → server/api/*           │                       │
   ┌────▼────┐             ┌────▼────┐                      ┌────▼────┐             ┌────▼────┐
   │ Triggers│             │ useQuery│                      │ combines│             │Template │
   │ (stats) │             │ cache   │                      │ several │             │ bindings│
   └─────────┘             └─────────┘                      └─────────┘             └─────────┘
```

---

## Layer 1: Database

### Tables (App Data)

| Table | Purpose | Written by (BFF endpoint) |
|-------|---------|-------------|
| `leagues` | League definitions | `/api/leagues/*` |
| `tournaments` | Tournament metadata + state | `/api/tournaments/*` (create/update/delete + lifecycle: start/advance-round/turn-back-round) |
| `players` | Player roster | `/api/players/*` |
| `rulesets` | Scoring rules | `/api/rulesets/*` |
| `waitroom` | Tournament registration queue | `/api/tournaments/:id/register-player`/`unregister-player` |
| `standings` | Live scores + ranks | `/api/tournaments/:id/start`/`advance-round`/`turn-back-round` |
| `pairings` | Table assignments per round | `/api/tournaments/:id/start`/`advance-round`/`turn-back-round` |
| `round_results` | Per-player round scores | `/api/pairings/:id/rankings`/`kills`/`commander`/`votes` |
| `commander_decks` | Player deck registry | `/api/decks/*` |

See `docs/architecture/api.md` for the full entity-by-entity CRUD reference (what's supported, what isn't, deliberate asymmetries).

### Denormalized Stats Tables

| Table | Populated By | Queried By |
|-------|-------------|------------|
| `player_stats` | Trigger on `round_results` changes | `usePlayerStats()` |
| `deck_stats` | Trigger on `round_results` changes | `useDeckStats()` |
| `commander_stats` | Materialized view (refreshed by trigger) | `useCommanderStats()` |

### Auto-Recalc Triggers

```
round_results INSERT/UPDATE/DELETE
        │
        ├──► recalc_player_stats(player_id)
        │       └── UPDATE player_stats SET ...
        │
        ├──► recalc_deck_stats(player_id, commander_1, commander_2)
        │       └── UPDATE deck_stats SET ...
        │
        └──► REFRESH MATERIALIZED VIEW commander_stats
```

See `docs/architecture/database.md` for full trigger documentation.

---

## Layer 2: Colada composables and Pinia stores

### Two categories — pick the right one for a new domain

| Category | Covers | Pattern |
|----------|--------|---------|
| **Pinia Colada (ADR-015)** | Every domain except the tournament lifecycle: leagues, rulesets, players, commander decks, player/deck/commander stats, match history, and the tournament domain's own reads (list, standings, pairings, pairing history) and plain CRUD | `use*Query.ts` (`useQuery`, reads) + `use*Mutations.ts` (`useMutation`, writes via `$fetch`, invalidates the query key `onSettled`) |
| **Pinia stores** | Only two kinds remain | `useTournamentStore` (`app/stores/tournaments.ts`) — the lifecycle state machine, see below. Plus 4 session stores (`rankings`/`kills`/`votes`/`commanders`) — ephemeral per-round UI state, `Map`/`Set`-based, `reset()`/`hydrate()`, no Supabase calls at all |

### Colada query/mutation pattern

```ts
// app/composables/league/useLeaguesQuery.ts — read side
export const LEAGUES_KEY = ['leagues']

export function useLeaguesQuery() {
  const supabase = useSupabaseClient()
  return useQuery({
    key: LEAGUES_KEY,
    query: async () => {
      const { data, error } = await supabase.from('leagues').select('*')
      if (error) throw error
      return data ?? []
    },
  })
}

// app/composables/league/useLeagueMutations.ts — write side
export function useLeagueMutations() {
  const queryCache = useQueryCache()
  const invalidate = () => queryCache.invalidateQueries({ key: LEAGUES_KEY })

  const createLeague = useMutation({
    mutation: (payload: LeagueFormPayload) =>
      $fetch('/api/leagues/create', { method: 'POST', body: payload }),
    onSettled: invalidate,
  })
  // ...updateLeague, deleteLeague follow the same shape
  return { createLeague, updateLeague, deleteLeague }
}
```

No `initialized` flag, no manual optimistic patching — Colada's cache + `invalidateQueries` handles both. SSR prefetching is automatic (no `useAsyncData` wrapper needed).

### `useTournamentStore` — the one lifecycle exception

`app/stores/tournaments.ts` owns `currentTournament` plus the multi-step lifecycle transitions (`startTournament`, `nextRound`, `turnBackRound`) and the ADR-007 `save*` round-result seam (`saveVote`, `saveCommander`, `savePairingRankings`, `savePairingKills`) — all direct BFF `$fetch` calls, no Supabase client, no read caches of its own. It's a store and not a Colada mutation because these are genuine multi-step server-orchestrated transitions, not single-entity CRUD. Reads for the tournament page (list, standings, pairings, pairing history) are still Colada queries in `tournament/useTournamentQueries.ts` — the store and the queries are kept in sync explicitly (see Layer 3).

### Store → Store / Query → Store Communication

Stores and Colada caches never call each other directly. Orchestration happens one level up, in a page composable:

```ts
// useTournamentPage.ts — orchestrates a Colada query + the lifecycle store
const tournamentStore = useTournamentStore()
const { data: eventsData } = useEventsQuery(leagueId)   // Colada

// Keep the store's currentTournament in sync with the Colada-cached list;
// lifecycle actions overwrite it with the fresher server response right after.
watch(eventsData, (list) => {
  const found = list?.find(e => e.tournament_id === tournamentId)
  if (found) tournamentStore.setCurrentTournament(found)
}, { immediate: true })
```

---

## Layer 3: Page composables

### Data Fetching

Colada's `useQuery` handles SSR prefetch and caching by itself — no `useAsyncData` wrapper is needed for any Colada-backed domain. A page composable's job is to **combine** several queries/mutations/the lifecycle store into the shape a page needs, plus own page-local UI state (modals, selections):

```ts
// Pattern, simplified from useLeaguesPage.ts / useTournamentPage.ts
export function useXxxPage() {
  const { data, isLoading } = useXxxQuery()        // Colada read
  const { createXxx, deleteXxx } = useXxxMutations() // Colada write

  const showCreateModal = ref(false)               // page-local UI state

  async function handleCreate(payload) {
    try {
      await createXxx.mutateAsync(payload)
    } catch (err) {
      toast.add({ title: '...', description: toErrorMessage(err, '...'), color: 'error' })
      return
    }
    showCreateModal.value = false
    toast.add({ title: '...', color: 'success' })
  }

  return { data, isLoading, showCreateModal, handleCreate }
}
```

### Composable Inventory (tournament page)

`useTournamentPage()` is the most complex orchestration composable — it combines 5 Colada queries, 2 Colada mutation sets, the lifecycle store, and page-local state (viewed round, table estimate):

| Source | What it provides |
|--------|-------------------|
| `useEventsQuery(leagueId)` (Colada) | Tournament list for the league — also the source `currentTournament` is derived from |
| `useEventStandingsQuery(tournamentId)` (Colada) | Live standings |
| `usePairingsQuery(tournamentId, round)` (Colada) | Pairings for a (reactive) round — used twice: current round, and the viewed round |
| `usePairingHistoryQuery(tournamentId)` (Colada) | Historical pairings, optimizer input |
| `useWaitroom(tournamentId)` (Colada) | Waiting list + `useWaitroomMutations` for register/unregister |
| `useTournamentStore()` | `currentTournament`, `startTournament`/`nextRound`/`turnBackRound` |
| `useTournamentMutations()` (Colada) | Plain CRUD: `createTournament`/`updateTournament`/`deleteTournament` |

**After a lifecycle transition** (`start`/`nextRound`/`turnBackRound`), `refreshAfterLifecycle()` refetches/invalidates exactly the Colada queries that transition touches (events list, standings, waitroom, pairings, pairing history) — the store's own state is already fresh from the transition's own server response.

### Other Composables

| Composable | Wraps | Used By |
|------------|-------|---------|
| `usePlayersQuery()` | `players` table (Colada) | Global (tournament page, player pages) |
| `useRulesetsQuery()` | `rulesets` table (Colada) | `/rulesets`, tournament page (ruleset lookup) |
| `useLeagueById(leagueId)` | Derives from `useLeaguesQuery()`'s cached list — no per-id fetch | `/league/:id`, tournament page |
| `useCommanderDecks(playerId)` | `commander_decks` + usage (Colada) | Player profile |
| `usePlayerStats(playerId)` | Direct `player_stats` table query (Colada) | Player profile |
| `useDeckStats(playerId, c1, c2?)` | Direct `deck_stats` table query (Colada) | Player deck page |
| `useCommanderStats(c1, c2?)` | `commander_stats` materialized view (Colada) | Global deck page |
| `useTournamentUrl()` | URL query param sync for tournament page phase/round | Tournament page |
| `useLiveStandings()` | Reactive standings from pairings + results | Tournament page |
| `useTableCalculator()` | Table size estimation and preview generation | Tournament page |
| `usePairingPresets()` | Saved player order presets | Tournament page (preview modal) |
| `useOptimizationNotifier()` | Toast notifications for pairing optimizer | Tournament page (preview modal) |
| `useCommanderCards()` | Local DB commander card data fetching | Deck/commander pages |
| `useCommanderSearch()` | Commander autocomplete search, filtered client-side from `useCommanderCatalogQuery()`'s cached catalog | Commander modal |
| `useCommanderWhitelists()` | Partner/background/companion whitelists derived from `useCommanderCatalogQuery()` | Commander modal |

---

## Layer 4: Components

### Data Binding Pattern

```vue
<!-- Page receives data from a page composable -->
<script setup>
const { data: players, pending } = usePlayersPage()  // ← Layer 3
</script>

<template>
  <div v-if="pending">Loading...</div>
  <PlayerNameTag
    v-for="player in players"
    :key="player.player_id"
    :name="player.player_name"
    :surname="player.player_surname"
  />
</template>
```

### Two-Way Flow: User Action → BFF → DB → Colada Cache

```
User clicks "Aggiungi Giocatore"
        │
        ▼
WaitingList.vue emits "add" event
        │
        ▼
Tournament page calls addToWaitingList(playerIds)
        │
        ▼
useTournamentPage.ts calls registerPlayers.mutateAsync(playerIds)
        │
        ▼
useWaitroomMutations.ts: $fetch('/api/tournaments/:id/register-player', { method: 'POST', body: { playerIds } })
        │
        ▼
server/api/tournaments/[tournamentId]/register-player.post.ts inserts into `waitroom`
  using the service-role key (bypasses RLS)
        │
        ▼
Mutation's onSettled invalidates the ['waitroom', tournamentId] Colada query
        │
        ▼
useWaitroom(tournamentId)'s useQuery refetches from Supabase (anon key, SELECT-only)
        │
        ▼
Vue reactivity updates WaitingList.vue UI
```

---

## Caching Strategy

| Layer | Cache | Invalidation |
|-------|-------|--------------|
| **Browser (Colada queries)** | `localStorage`, all Colada query entries — see [`client-caching.md`](client-caching.md) | `staleTime`/`gcTime` per query (5s/5min default, 30 days for the commander catalog); manual `refetch()`; mutation `onSettled: invalidate` |
| **Browser (session stores)** | `localStorage`, one key per tournament — see [`client-caching.md`](client-caching.md) | 12h TTL or round-number mismatch (`useSessionStorePersistence`) |
| **Pinia store (`useTournamentStore`)** | Reactive ref (`currentTournament`), no other cache state | Overwritten by each lifecycle action's own server response, and kept in sync with the Colada-cached tournament list via an explicit `watch` |
| **PostgreSQL** | Materialized view (`commander_stats`) | Refreshed by trigger on `round_results` changes |

---

## Key Patterns

### 1. SSR + Client Hydration (Colada)

```ts
// useQuery prefetches on the server automatically — no useAsyncData needed
const { data, isLoading } = useLeaguesQuery()
// On client, data is hydrated from the server payload; refetch() forces a re-read
```

### 2. Invalidate-and-Refetch, Not Manual Optimistic Patching

```ts
// Mutation invalidates the query key; Colada refetches server truth itself
const createLeague = useMutation({
  mutation: (payload) => $fetch('/api/leagues/create', { method: 'POST', body: payload }),
  onSettled: () => queryCache.invalidateQueries({ key: LEAGUES_KEY }),
})
```

### 3. Lifecycle Transitions Refresh a Specific Set of Queries

```ts
// After a multi-step BFF transition, refetch exactly what it touched —
// see useTournamentPage.ts's refreshAfterLifecycle()
async function startTournament(playerOrder?: number[]) {
  const result = await tournamentStore.startTournament(tournamentId, playerOrder)
  if (!result.success) return false
  await refreshAfterLifecycle()
  return true
}
```

### 4. Cross-Page State via URL

Tournament modals persist state in URL query params (see `docs/architecture/modal-url-sync.md`):
- Modal open/close ↔ query param add/remove
- Enables back-button dismissal and direct linking

---

## Anti-Patterns to Avoid

| Pattern | Why Avoid | Correct Approach |
|---------|-----------|----------------|
| Calling `supabase.from(...).insert/update/delete(...)` in components or composables | Bypasses the BFF authorization boundary (ADR-013) — a genuine security regression, not just a style issue | `useMutation` → `$fetch('/api/...')` to a BFF endpoint |
| Adding a `useAsyncData` wrapper around a Colada query | Redundant — Colada's `useQuery` already SSR-prefetches and caches | Call the `use*Query()` composable directly |
| Manually patching Colada cache data after a mutation | Fragile, drifts from server truth | `onSettled: () => queryCache.invalidateQueries({ key })` |
| Props drilling through 3+ layers | Unmaintainable | Use composables or stores at appropriate level |
| `fetch()` without error handling | Silent failures | Use `$fetch` (ofetch) or always check `response.ok` |

---

## Related Docs

- `docs/architecture/stores.md` — The two remaining store categories in detail
- `docs/architecture/async-data-keys.md` — Colada query key naming convention and full key inventory
- `docs/architecture/database.md` — Trigger architecture and denormalized stats
- `docs/architecture/api.md` — Entity-by-entity CRUD reference (BFF endpoints)
- `docs/architecture/event-flow.md` — Tournament lifecycle and DB mutations
