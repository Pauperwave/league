# State Flow

<!-- docs/architecture/state-flow.md -->

How data moves through the application: **Database → Store → Composable → Component**.

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PostgreSQL    │────▶│  Pinia Store    │────▶│  Composable     │────▶│   Vue Page      │
│   (Supabase)    │     │  (Client state) │     │  (SSR wrapper)  │     │   (UI)          │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │                       │
        │                       │                       │                       │
   ┌────▼────┐             ┌────▼────┐             ┌────▼────┐             ┌────▼────┐
   │ Triggers│             │ Reactive│             │useAsync │             │Template │
   │ (stats) │             │  refs   │             │  Data   │             │ bindings│
   └─────────┘             └─────────┘             └─────────┘             └─────────┘
```

---

## Layer 1: Database

### Tables (App Data)

| Table | Purpose | Writes From |
|-------|---------|-------------|
| `leagues` | League definitions | `LeagueFormModal` |
| `events` | Event metadata + state | `EventFormModal`, `useEventStore` lifecycle actions |
| `players` | Player roster | `CreatePlayerModal` |
| `rulesets` | Scoring rules | `RulesetFormModal` |
| `waitroom` | Event registration queue | `WaitingList` add/remove |
| `standings` | Live scores + ranks | `startEvent`, `nextRound` |
| `pairings` | Table assignments per round | `startEvent`, `nextRound` |
| `round_results` | Per-player round scores | `TableScoreGrid` submit |
| `commander_decks` | Player deck registry | `DeckCreateModal`, `DeckEditModal` |

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

## Layer 2: Pinia Stores

### Store Categories

| Category | Stores | Persistence | Pattern |
|------------|--------|-------------|---------|
| **Supabase stores** | `useLeagueStore`, `useEventStore`, `usePlayerStore`, `useRulesetStore`, `useCommanderDeckStore` | Persistent (reactive refs) | `initialized` flag, optimistic updates, `{ success, error?, data? }` returns |
| **Session stores** | `useRankingsStore`, `useKillsStore`, `useVotesStore`, `useCommandersStore` | Ephemeral (per round) | `Map<number, ...>`, `reset()` between rounds |

### Store Responsibilities

| Store | Owns | Mutations |
|-------|------|-----------|
| `useLeagueStore` | `leagues[]`, loading state | `fetchLeagues`, `createLeague`, `updateLeague`, `deleteLeague` |
| `useEventStore` | `events[]`, `currentEvent`, `standings[]`, `pairings[]`, `pairingHistory[]` | Full lifecycle: `startEvent`, `nextRound`, `turnBackRound`, `submitRoundResult` |
| `usePlayerStore` | `players[]`, `waitingPlayers[]`, `waitroomEntries[]` | `fetchPlayers`, `addToWaitingList`, `removeFromWaitingList` |
| `useRulesetStore` | `rulesets[]` | `fetchRulesets`, `createRuleset`, `updateRuleset` |
| `useCommanderDeckStore` | `decks[]` | `fetchDecks`, `fetchDecksByPlayer`, `createDeck`, `updateDeck`, `deleteDeck` |
| `useRankingsStore` | Round rankings (ephemeral) | `setRankings`, `reset` |
| `useKillsStore` | Kill flow state (ephemeral) | `setKills`, `addKill`, `reset` |
| `useVotesStore` | Vote selections (ephemeral) | `setVotes`, `reset` |
| `useCommandersStore` | Commander assignments (ephemeral) | `setCommander`, `reset` |

### Store → Store Communication

Stores are **independent**. Pages/composables orchestrate cross-store coordination:

```ts
// useEventPage.ts — orchestrates multiple stores
const eventStore = useEventStore()
const playerStore = usePlayerStore()

await Promise.all([
  eventStore.fetchEvents(leagueId),
  playerStore.fetchWaitingPlayers(eventId),
])
```

---

## Layer 3: Composables

### SSR-Friendly Data Fetching

All Supabase-facing composables wrap store calls in `useAsyncData`:

```ts
// Pattern: app/composables/supabase/useXxx.ts
export function useXxx(id: Ref<number | undefined>) {
  const store = useXxxStore()

  return useAsyncData(
    `domain-scope-${id.value}`,  // unique key per docs/architecture/async-data-keys.md
    () => store.fetchXxx(id.value),
    {
      immediate: true,
      watch: [id],
    }
  )
}
```

### Composable Inventory

| Composable | Wraps | Returns | Used By |
|------------|-------|---------|---------|
| `useLeagues()` | `useLeagueStore.fetchLeagues()` | `{ data, pending, error, refresh }` | `/leagues`, `/league/:id` |
| `useEvents(leagueId)` | `useEventStore.fetchEvents()` | `{ data, pending, error, refresh }` | `/league/:id` |
| `usePlayers()` | `usePlayerStore.fetchPlayers()` | `{ data, pending, error, refresh }` | Global (event page, player pages) |
| `useRulesets()` | `useRulesetStore.fetchRulesets()` | `{ data, pending, error, refresh }` | `/rulesets` |
| `useStandings(eventId)` | `useEventStore.fetchStandings()` | `{ data, pending, error, refresh }` | Event page |
| `usePairings(eventId, round)` | `useEventStore.fetchPairings()` | `{ data, pending, error, refresh }` | Event page |
| `useWaitroom(eventId)` | `usePlayerStore.fetchWaitingPlayers()` | `{ data, pending, error, refresh }` | Event page |
| `useRoundResults(eventId, round)` | `useEventStore.fetchPairings()` + join | `{ data, pending, error, refresh }` | Event page |
| `useTournaments(eventId)` | `useEventStore.fetchPairingHistory()` | `{ data, pending, error, refresh }` | Event page |
| `useCommanderDecks(playerId)` | `useCommanderDeckStore.fetchDecksByPlayer()` | `{ data, pending, isDeckInUse, getDeckEventCount }` | Player profile |
| `usePlayerStats(playerId)` | Direct `player_stats` table query | `{ data: PlayerStats }` | Player profile |
| `useDeckStats(playerId, c1, c2?)` | Direct `deck_stats` table query | `{ data: DeckStats }` | Player deck page |
| `useCommanderStats(c1, c2?)` | `commander_stats` materialized view | `{ data: CommanderStats }` | Global deck page |

### Non-Data Composables

| Composable | Purpose |
|------------|---------|
| `useEventPage()` | Orchestrates all event data and lifecycle actions |
| `useEventUrl()` | URL query param sync for event page modals |
| `useLiveStandings()` | Reactive standings from pairings + results |
| `useTableCalculator()` | Table size estimation and preview generation |
| `usePairingPresets()` | Saved player order presets |
| `useOptimizationNotifier()` | Toast notifications for pairing optimizer |
| `useCommanderCards()` | Local DB commander card data fetching |
| `useCommanderSearch()` | Commander autocomplete search, filtered client-side from `useCommanderCatalogQuery()`'s cached catalog |
| `useCommanderWhitelists()` | Partner/background/companion whitelists derived from `useCommanderCatalogQuery()` |

---

## Layer 4: Components

### Data Binding Pattern

```vue
<!-- Page receives data from composable -->
<script setup>
const { data: players, pending } = usePlayers()  // ← Layer 3
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

### Two-Way Flow: User Action → Store → DB

```
User clicks "Aggiungi Giocatore"
        │
        ▼
WaitingList.vue emits "add" event
        │
        ▼
Event page calls addToWaitingList(playerIds)
        │
        ▼
useEventPage.ts calls playerStore.addToWaitingList(eventId, playerId)
        │
        ▼
usePlayerStore.ts: supabase.from('waitroom').insert({ event_id, player_id })
        │
        ▼
PostgreSQL inserts row
        │
        ▼
Store updates local: waitroomEntries.value.push(newEntry)
        │
        ▼
Vue reactivity updates WaitingList.vue UI
```

---

## Caching Strategy

| Layer | Cache | Invalidation |
|-------|-------|--------------|
| **Browser (Colada queries)** | `localStorage`, all Colada query entries — see [`client-caching.md`](client-caching.md) | `staleTime`/`gcTime` per query (5s/5min default, 30 days for the commander catalog); manual `refetch()` |
| **Browser (session stores)** | `localStorage`, one key per event — see [`client-caching.md`](client-caching.md) | 12h TTL or round-number mismatch (`useSessionStorePersistence`) |
| **Nuxt SSR** | `useAsyncData` cache (non-Colada composables only) | `refreshNuxtData(key)` or page navigation |
| **Pinia store** | Reactive refs (lifecycle + session stores only) | Overwritten on fetch, optimistic updates on mutation |
| **PostgreSQL** | Materialized view (`commander_stats`) | Refreshed by trigger on `round_results` changes |

---

## Key Patterns

### 1. SSR + Client Hydration

```ts
// Composable returns SSR-fetched data
const { data } = useAsyncData('players', () => store.fetchPlayers())

// On client, data is hydrated from server payload
// On subsequent interactions, call refresh()
```

### 2. Optimistic Updates

```ts
// Store updates local state before DB confirms
async function createDeck(deckData) {
  const result = await supabase.from('commander_decks').insert(deckData)
  if (result.data) {
    decks.value.push(result.data)  // optimistic
  }
}
```

### 3. Refresh After Mutation

```ts
// After store mutation, invalidate composable cache
async function handleCreateDeck(deckData) {
  const result = await deckStore.createDeck(deckData)
  if (result.success) {
    refreshNuxtData(`commander-decks-${playerId.value}`)  // invalidate composable
  }
}
```

### 4. Cross-Page State via URL

Event modals persist state in URL query params (see `docs/architecture/modal-url-sync.md`):
- Modal open/close ↔ query param add/remove
- Enables back-button dismissal and direct linking

---

## Anti-Patterns to Avoid

| Pattern | Why Avoid | Correct Approach |
|---------|-----------|----------------|
| Calling `supabase` directly in components | Leaks DB logic into UI | Use store actions |
| Storing `useAsyncData` in Pinia | `useAsyncData` is page-level | Keep in composables/pages |
| Manual cache invalidation everywhere | Fragile | Use `refreshNuxtData(key)` consistently |
| Props drilling through 3+ layers | Unmaintainable | Use composables or stores at appropriate level |
| `fetch()` without error handling | Silent failures | Use `$fetch` (ofetch) or always check `response.ok` |

---

## Related Docs

- `docs/architecture/stores.md` — Pinia store patterns and conventions
- `docs/architecture/async-data-keys.md` — useAsyncData key naming convention
- `docs/architecture/database.md` — Trigger architecture and denormalized stats
- `docs/architecture/event-flow.md` — Event lifecycle and DB mutations
