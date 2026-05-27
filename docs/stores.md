# Pinia Stores Documentation

## Overview

This application uses Pinia for state management with **8 stores** (4 Supabase + 4 Session) that centralize state and logic. All stores use the **Setup API** pattern (`defineStore('id', () => { ... })`).

Stores are divided into two categories:

| Store | Type | File | Purpose |
|-------|------|------|---------|
| `useLeagueStore` | Supabase | `app/stores/leagues.ts` | League CRUD |
| `useRulesetStore` | Supabase | `app/stores/rulesets.ts` | Ruleset CRUD |
| `usePlayerStore` | Supabase | `app/stores/players.ts` | Players + waitroom |
| `useEventStore` | Supabase | `app/stores/events.ts` | Events, standings, pairings, rounds |
| `useRankingsStore` | Session | `app/stores/rankings.ts` | Player rankings per pairing (score modal) |
| `useKillsStore` | Session | `app/stores/kills.ts` | Kill tracking in round |
| `useVotesStore` | Session | `app/stores/votes.ts` | Deck/Play votes |
| `useCommandersStore` | Session | `app/stores/commanders.ts` | Commander per player |

---

## Setup API Pattern

All stores follow the **Setup API** pattern (migrated 2026-05-25):

```typescript
export const useXxxStore = defineStore('xxx', () => {
  // State
  const items = ref<Item[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  // Getters (computed)
  const getById = computed(() => (id: number) => 
    items.value.find(i => i.id === id) ?? null
  )

  // Actions (plain functions)
  async function fetchItems(force = false) {
    if (initialized.value && !force) return
    loading.value = true
    // ... fetch logic
    initialized.value = true
    loading.value = false
  }

  // Explicit return of public API
  return {
    items, loading, error,
    getById,
    fetchItems
  }
})
```

**Key differences from Options API:**
- State: `ref()` instead of `state: () => ({ ... })`
- Getters: `computed()` instead of `getters: { ... }`
- Actions: plain functions instead of `actions: { ... }`
- **Everything is explicit** — only returned values are accessible

---

## Supabase Stores (4)

These stores manage persistent data from Supabase. They share common patterns:
- `initialized` flag to prevent duplicate fetches
- `loading` state (single boolean or per-action flags)
- `error` state with consistent handling
- Optimistic local updates after mutations

---

### `useLeagueStore` (`app/stores/leagues.ts`)

**Responsibility**: League management

#### State
| State | Type | Description |
|-------|------|-------------|
| `leagues` | `ref<League[]>` | All leagues |
| `currentLeague` | `ref<League \| null>` | Selected league |
| `error` | `ref<string \| null>` | Error state |
| `initialized` | `ref<boolean>` | Prevent duplicate fetches |
| `loadingFetch/Create/Update/Delete` | `ref<boolean>` | Per-action loading flags |
| `loading` | `computed` | True if any action is loading |

#### Getters
| Getter | Signature | Description |
|--------|-----------|-------------|
| `getLeagueById` | `(id: number) => League \| null` | Find league by ID |
| `sortedLeagues` | `computed` | Leagues sorted by start date (newest first) |

#### Actions
| Action | Description |
|--------|-------------|
| `fetchLeagues(force?)` | Load all leagues |
| `createLeague(league)` | Create new league |
| `updateLeague(id, updates)` | Update existing league |
| `deleteLeague(id)` | Delete league by ID |
| `setCurrentLeague(league)` | Set active league |
| `clearError()` | Clear error state |

---

### `useRulesetStore` (`app/stores/rulesets.ts`)

**Responsibility**: Tournament ruleset management

#### State
| State | Type | Description |
|-------|------|-------------|
| `rulesets` | `ref<Ruleset[]>` | All rulesets |
| `loading` | `ref<boolean>` | Loading state |
| `error` | `ref<string \| null>` | Error state |
| `initialized` | `ref<boolean>` | Prevent duplicate fetches |

#### Getters
| Getter | Signature | Description |
|--------|-----------|-------------|
| `getRulesetById` | `(id: number) => Ruleset \| null` | Find ruleset by `ruleset_id` |

#### Actions
| Action | Description |
|--------|-------------|
| `fetchRulesets(force?)` | Load all rulesets |
| `createRuleset(ruleset)` | Create new ruleset |
| `updateRuleset(id, updates)` | Update existing ruleset |
| `deleteRuleset(id)` | Delete ruleset (checks if used by leagues first) |
| `clearError()` | Clear error state |

---

### `usePlayerStore` (`app/stores/players.ts`)

**Responsibility**: Player management and event waitroom

#### Utility: `sanitizePlayer<T>(player: T): T`
Replaces underscores with spaces in player names. Database uses underscores for compound names (e.g., `Mario_Rossi`), this function converts to human-readable format.

#### State
| State | Type | Description |
|-------|------|-------------|
| `players` | `ref<Player[]>` | All players (names sanitized on fetch) |
| `waitingPlayers` | `ref<number[]>` | Player IDs in current event waitroom |
| `waitroomEntries` | `ref<Map<number, string>>` | playerId → insertedAt timestamp |
| `loading` | `ref<boolean>` | Loading state |
| `error` | `ref<string \| null>` | Error state |
| `initialized` | `ref<boolean>` | Prevent duplicate fetches |

#### Getters
| Getter | Signature | Description |
|--------|-----------|-------------|
| `getPlayerById` | `(id: number) => Player \| null` | Find player by ID |
| `getPlayersByIds` | `(ids: number[]) => Player[]` | Find multiple players |
| `searchPlayers` | `(query: string) => Player[]` | Search by name/surname |

#### Actions
| Action | Description |
|--------|-------------|
| `fetchPlayers(force?)` | Load all players (sanitizes names) |
| `createPlayer(player)` | Create new player |
| `updatePlayer(playerId, player)` | Update existing player |
| `fetchWaitingPlayers(eventId)` | Load waitroom for event |
| `addToWaitingList(eventId, playerId)` | Add player to waitroom |
| `removeFromWaitingList(eventId, playerId)` | Remove from waitroom |
| `clearError()` | Clear error state |

---

### `useEventStore` (`app/stores/events.ts`)

**Responsibility**: Event management, tournament standings, pairings, and round lifecycle

This is the most complex store. Uses **loading counter** (`loadingCount`) instead of boolean — stays true as long as ANY async action is in flight.

#### State
| State | Type | Description |
|-------|------|-------------|
| `events` | `ref<Event[]>` | Events by league |
| `currentEvent` | `ref<Event \| null>` | Selected event |
| `standings` | `ref<StandingWithPlayer[]>` | Current standings data |
| `pairings` | `ref<PairingWithResults[]>` | Current round pairings |
| `pairingHistory` | `ref<PairingHistoryEntry[]>` | Historical pairings for pairing optimizer |
| `loadingCount` | `ref<number>` | Counter for nested loading |
| `loading` | `computed` | `loadingCount > 0` |
| `error` | `ref<string \| null>` | Error state |
| `initialized` | `ref<Record<number, boolean>>` | Per-league initialization |

#### Helper functions
- `beginLoading()`: `loadingCount.value++`
- `endLoading()`: `loadingCount.value = Math.max(0, loadingCount.value - 1)`
- `toErrorMessage(err, fallback)`: Consistent error message extraction

#### Getters
| Getter | Signature | Description |
|--------|-----------|-------------|
| `getEventsByLeagueId` | `(leagueId: number) => Event[]` | Filter events by league |
| `isEventEnded` | `computed<boolean>` | Check if event has finished all rounds |

#### Actions — Event Lifecycle
| Action | Description |
|--------|-------------|
| `fetchEvents(leagueId, force?)` | Load events for league |
| `createEvent(event)` | Create new event |
| `updateEvent(eventId, updates)` | Update existing event |
| `deleteEvent(eventId)` | Delete event |
| `startEvent(eventId, playerOrder?)` | Start event: creates standings, clears waitroom, creates first round pairings |
| `nextRound(eventId, currentRound)` | Calculate scores, update standings, increment round, create new pairings |
| `turnBackRound(eventId, currentRound, leagueId)` | Go back to previous round (or registration state from round 1) |
| `setCurrentEvent(event)` | Set active event |

#### Actions — Round Data
| Action | Description |
|--------|-------------|
| `createPairings(eventId, round)` | Generate optimized pairings using `pairingOptimizer` |
| `fetchPairings(eventId, round)` | Load pairings with round results |
| `fetchPairingHistory(eventId)` | Load historical pairings for optimizer |
| `submitRoundResult(result)` | Insert new round result |
| `updateRoundResult(pairingId, playerId, result)` | Update existing round result |

#### Actions — Standings
| Action | Description |
|--------|-------------|
| `fetchStandings(eventId)` | Load standings for single event |
| `fetchMultipleEventStandings(eventIds)` | Load standings across multiple events |
| `fetchLeagueStandings(leagueId)` | Simple sum aggregation across all league events |
| `fetchLeagueResults(leagueId)` | Full ruleset scoring (valid events, participation bonus, tie-breakers) |

#### Score Calculation in `nextRound`
Uses ruleset values:
- **Rank score**: Based on position (1st, 2nd, 3rd, 4th) with tied-position averaging
- **Kill score**: `number_of_kills × rule_set_kill`
- **Brew score**: `brew_votes × rule_set_brew`
- **Play score**: `play_votes × rule_set_play`

---

## Session Stores (4)

These stores manage **ephemeral UI state** for the event page. They:
- Don't interact with Supabase directly
- Use simple `Map<number, ...>` patterns for per-pairing/player data
- Have a `reset()` action to clear state between rounds

---

### `useRankingsStore` (`app/stores/rankings.ts`)

**Responsibility**: Player ranking order per pairing (for score modal)

#### Interface
```typescript
interface RankingEntry {
  playerId: number
  rank: number
}
```

#### State
| State | Type | Description |
|-------|------|-------------|
| `rankingsWithRanks` | `ref<Map<number, RankingEntry[]>>` | pairingId → ranking array |

#### Getters
| Getter | Signature | Description |
|--------|-----------|-------------|
| `getRankingWithRanks` | `(pairingId: number) => RankingEntry[] \| undefined` | Get ranking for pairing |
| `hasRanking` | `(pairingId: number) => boolean` | Check if ranking exists |

#### Actions
| Action | Description |
|--------|-------------|
| `setRankingWithRanks(pairingId, ranking)` | Set ranking for pairing |
| `removeRanking(pairingId)` | Remove ranking |
| `reset()` | Clear all rankings |

---

### `useKillsStore` (`app/stores/kills.ts`)

**Responsibility**: Kill tracking during a round

#### Interface
```typescript
interface Kill {
  killerId: number
  victimId: number
}
```

#### State
| State | Type | Description |
|-------|------|-------------|
| `kills` | `ref<Kill[]>` | All kills in current round |

#### Getters
| Getter | Signature | Description |
|--------|-----------|-------------|
| `isKillPresent` | `(killerId, victimId) => boolean` | Check if kill exists |
| `isReverseKillPresent` | `(killerId, victimId) => boolean` | Check if victim already killed killer |
| `hasSuicided` | `(playerId) => boolean` | Check for self-kill |
| `killsByKiller` | `(killerId) => number[]` | Get victims by killer |
| `deathsByVictim` | `(victimId) => number` | Get death count |

#### Actions
| Action | Description |
|--------|-------------|
| `addKill(killerId, victimId)` | Add kill (validates no duplicate/reverse) |
| `removeKill(killerId, victimId)` | Remove kill |
| `reset()` | Clear all kills |

---

### `useVotesStore` (`app/stores/votes.ts`)

**Responsibility**: Deck and Play votes during a round

#### Interface
```typescript
interface VoteEntry {
  playerId: number
  deckVotePlayerId: number | null
  playVotePlayerId: number | null
}
```

#### State
| State | Type | Description |
|-------|------|-------------|
| `votes` | `ref<Map<number, VoteEntry>>` | playerId → votes |

#### Getters
| Getter | Signature | Description |
|--------|-----------|-------------|
| `getVotes` | `(playerId) => VoteEntry \| undefined` | Get full entry |
| `getDeckVote` | `(playerId) => number \| null` | Get deck vote |
| `getPlayVote` | `(playerId) => number \| null` | Get play vote |
| `hasVotes` | `(playerId) => boolean` | Check if player has any votes |

#### Actions
| Action | Description |
|--------|-------------|
| `setVotes(playerId, deckVote, playVote)` | Set both votes |
| `setDeckVote(playerId, deckVotePlayerId)` | Set only deck vote |
| `setPlayVote(playerId, playVotePlayerId)` | Set only play vote |
| `removeVotes(playerId)` | Remove votes for player |
| `reset()` | Clear all votes |

---

### `useCommandersStore` (`app/stores/commanders.ts`)

**Responsibility**: Commander tracking during a round

#### Interface
```typescript
interface CommanderEntry {
  playerId: number
  commander1: string | null
  commander2: string | null
}
```

#### State
| State | Type | Description |
|-------|------|-------------|
| `commanders` | `ref<Map<number, CommanderEntry>>` | playerId → commanders |

#### Getters
| Getter | Signature | Description |
|--------|-----------|-------------|
| `getCommanders` | `(playerId) => CommanderEntry \| undefined` | Get full entry |
| `getCommander1` | `(playerId) => string \| null` | Get first commander |
| `getCommander2` | `(playerId) => string \| null` | Get second commander |

#### Actions
| Action | Description |
|--------|-------------|
| `setCommanders(playerId, commander1, commander2)` | Set both commanders |
| `setCommander1(playerId, commander1)` | Set only first commander |
| `setCommander2(playerId, commander2)` | Set only second commander |
| `removeCommanders(playerId)` | Remove commanders for player |
| `reset()` | Clear all commanders |

---

## Composables Pattern

Composables in `app/composables/supabase/` wrap store calls for SSR-friendly data fetching:

```typescript
export function useXxx(params) {
  const store = useXxxStore()
  
  const { data, pending, error } = useAsyncData('key', async () => {
    await store.fetchXxx(params)
    return store.items
  })
  
  return { data, pending, error, refresh: () => store.fetchXxx(params, true) }
}
```

**Responsibilities:**
1. **Store**: Single source of truth, Supabase calls, optimistic updates
2. **Composable**: `useAsyncData` wrapper, SSR support, returns `{ data, pending, error, refresh }`

---

## Error Handling

All Supabase stores follow consistent error handling:

```typescript
try {
  const { data, error: supaError } = await supabase.from('table').select('*')
  if (supaError) throw supaError
  // Update state
} catch (err) {
  error.value = err instanceof Error ? err.message : 'Generic error message'
  console.error('[useXxxStore] actionName error:', err)
  return { success: false, error: error.value }
} finally {
  loading.value = false  // or endLoading()
}
```

**Key patterns:**
- Destructure `error` with alias (`error: supaError`) to avoid shadowing
- Set `error.value` for UI display
- Log to `console.error` with store/action context
- Return `{ success: boolean, error?: string, data?: T }` for caller handling

---

## Architecture Decisions

1. **Setup API exclusively**: All stores migrated to Setup API for better TypeScript inference and more flexible composition.
2. **Two store categories**: Supabase stores for persistent data, Session stores for ephemeral UI state on the event page.
3. **Per-action loading flags**: `leagues.ts` uses separate booleans; `events.ts` uses a counter for nested async operations.
4. **Composables as orchestrators**: Composables wrap store calls in `useAsyncData` for SSR support, stores manage the actual state.
5. **Initialization flags**: Prevent duplicate fetches on navigation (`initialized` boolean or `Record<number, boolean>` for per-league).
6. **Optimistic updates**: Local state is updated immediately after successful Supabase mutation, before refetch.

---

## Migration Note (2026-05-25)

All 8 stores were migrated from Options API to **Setup API**:

| Before (Options API) | After (Setup API) |
|----------------------|-------------------|
| `state: () => ({ ... })` | `const x = ref(...)` |
| `getters: { ... }` | `const x = computed(...)` |
| `actions: { ... }` | Plain `function` |
| Implicit `this` | Explicit `return { ... }` |

Benefits:
- Better TypeScript inference without `this`
- More flexible composition (can use other composables directly)
- Explicit public API via `return` statement
- Consistent with Composition API used in components

See also: [`PROGRESS.md`](../PROGRESS.md) for high-level architecture overview.
