# Pinia Stores Documentation

## Overview

This application uses Pinia for state management with 4 stores that centralize all Supabase interactions. Each store follows the same pattern:

- **State**: Reactive data with `initialized` flag to prevent duplicate fetches
- **Getters**: Computed properties for filtering/deriving state
- **Actions**: Async methods that call Supabase and update state

---

## `useLeagueStore` (`app/stores/leagues.ts`)

**Responsibility**: League management

### State
- `leagues: League[]` - All leagues
- `currentLeague: League | null` - Selected league
- `loading: boolean` - Loading state
- `error: string | null` - Error message
- `initialized: boolean` - Prevent duplicate fetches

### Getters
- `getLeagueById(id: number)` - Find league by ID
- `sortedLeagues` - Leagues sorted by start date (newest first)

### Actions
| Action | Description |
|--------|-------------|
| `fetchLeagues(force?)` | Load all leagues |
| `createLeague(league)` | Create new league |
| `deleteLeague(id)` | Delete league by ID |
| `setCurrentLeague(league)` | Set active league |
| `clearError()` | Clear error state |

---

## `usePlayerStore` (`app/stores/players.ts`)

**Responsibility**: Player management and event waitroom

### State
- `players: Player[]` - All players
- `waitingPlayers: number[]` - Player IDs in current event waitroom
- `loading: boolean`
- `error: string | null`
- `initialized: boolean`

### Getters
- `getPlayerById(id)` - Find player by ID
- `getPlayersByIds(ids)` - Find multiple players
- `searchPlayers(query)` - Search by name/surname

### Actions
| Action | Description |
|--------|-------------|
| `fetchPlayers(force?)` | Load all players |
| `createPlayer(player)` | Create new player |
| `fetchWaitingPlayers(eventId)` | Load waitroom for event |
| `addToWaitingList(eventId, playerId)` | Add player to waitroom |
| `removeFromWaitingList(eventId, playerId)` | Remove from waitroom |
| `clearError()` | Clear error state |

### Utility Function

```ts
export function sanitizePlayer(player: Player): Player
```

Sanitizes player names by replacing underscores with spaces. The database uses underscores for compound names (e.g., `Mario_Rossi`), this function converts to human-readable format (e.g., `Mario Rossi`).

**Usage**: Imported by `events.ts` for sanitizing player data in standings.

---

## `useEventStore` (`app/stores/events.ts`)

**Responsibility**: Event management, tournament standings, and pairings

### State
- `events: Event[]` - Events by league
- `currentEvent: Event | null` - Selected event
- `standings: Standing[]` - Current standings data
- `pairings: Pairing[]` - Current round pairings
- `loading: boolean`
- `error: string | null`
- `initialized: Record<number, boolean>` - Per-league initialization tracking

### Getters
- `getEventsByLeagueId(leagueId)` - Filter events by league
- `isEventEnded` - Check if event has finished all rounds

### Actions

#### Event CRUD
| Action | Description |
|--------|-------------|
| `fetchEvents(leagueId, force?)` | Load events for league |
| `createEvent(event)` | Create new event |
| `deleteEvent(eventId)` | Delete event |
| `startEvent(eventId)` | Start event: create standings, pairings, clear waitroom |
| `setCurrentEvent(event)` | Set active event |

#### Standings
| Action | Description |
|--------|-------------|
| `fetchStandings(eventId)` | Load standings for single event |
| `fetchLeagueStandings(leagueId)` | Aggregate standings across all league events (simple sum) |
| `fetchLeagueResults(leagueId)` | Calculate standings with ruleset scoring (valid events, participation bonus, tie-breakers) |

#### Pairings & Results
| Action | Description |
|--------|-------------|
| `fetchPairings(eventId, round)` | Load pairings with round results for a round |
| `createPairings(eventId, round)` | Generate Swiss-style pairings for round |
| `submitRoundResult(result)` | Insert new round result |
| `updateRoundResult(pairingId, playerId, result)` | Update existing result |

#### Round Management
| Action | Description |
|--------|-------------|
| `nextRound(eventId, currentRound)` | Calculate scores, update standings, increment round, create new pairings |
| `turnBackRound(eventId, currentRound, leagueId)` | Go back to previous round (or registration state) |

### Score Calculation (in `nextRound`)

Uses ruleset values:
- **Rank score**: Based on position (1st, 2nd, 3rd, 4th)
- **Kill score**: `number_of_kills × rule_set_kill`
- **Brew score**: `brew_votes × rule_set_brew`
- **Play score**: `play_votes × rule_set_play`
- **Tie handling**: Players with same position share rank points

---

## `useRulesetStore` (`app/stores/rulesets.ts`)

**Responsibility**: Tournament ruleset management

### State
- `rulesets: Ruleset[]` - All rulesets
- `loading: boolean`
- `error: string | null`
- `initialized: boolean`

### Getters
- `getRulesetById(id)` - Find ruleset by ID

### Actions
| Action | Description |
|--------|-------------|
| `fetchRulesets(force?)` | Load all rulesets |
| `clearError()` | Clear error state |

### Usage
Used in `CreateLeagueModal` for ruleset selection during league creation.

---

## Composables Pattern

All composables in `app/composables/supabase/` follow the same pattern:

1. Use store as single source of truth
2. Call `useAsyncData` for SSR-friendly data fetching
3. Return `{ data, pending, error, refresh }`

Example:
```ts
export function useXxx(params) {
  const store = useXxxStore()
  
  const { data, pending, error } = useAsyncData('key', async () => {
    await store.fetchXxx(params)
    return store.items
  })
  
  return { data, pending, error, refresh: () => store.fetchXxx(params, true) }
}
```

---

## Error Handling

All stores follow consistent error handling:

```ts
try {
  const { data, error: supaError } = await supabase.from('table').select('*')
  if (supaError) throw supaError
  // Update state
} catch (err) {
  error.value = err instanceof Error ? err.message : 'Generic error message'
  console.error('[useXxxStore] actionName error:', err)
  return { success: false, error: error.value }
} finally {
  loading.value = false
}
```

---

## Architecture Decisions

1. **Centralized Supabase**: All Supabase calls happen in store actions, never in components or composables directly
2. **Composables as Orchestrators**: Composables wrap store calls in `useAsyncData` for SSR support
3. **Sanitization**: Player name sanitization happens once in `players.ts` and is reused by `events.ts`
4. **Initialization Flags**: Prevent duplicate fetches on navigation
5. **Return Types**: Actions return `{ success, data }` or `{ success, error }` for consistent handling
