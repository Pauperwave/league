# Pinia Stores

10 stores using the **Setup API** pattern: 6 Supabase (persistent) + 4 Session (ephemeral).

| Store | Type | File | Purpose |
|-------|------|------|---------|
| `useLeagueStore` | Supabase | `app/stores/leagues.ts` | League CRUD |
| `useRulesetStore` | Supabase | `app/stores/rulesets.ts` | Ruleset CRUD |
| `usePlayerStore` | Supabase | `app/stores/players.ts` | Players + waitroom |
| `usePlayerStatsStore` | Supabase | `app/stores/player-stats.ts` | Denormalized `player_stats` read cache |
| `useCommanderDeckStore` | Supabase | `app/stores/commander-decks.ts` | Commander deck CRUD |
| `useEventStore` | Supabase | `app/stores/events.ts` | Events, standings, pairings, rounds |
| `useRankingsStore` | Session | `app/stores/rankings.ts` | Player rankings per pairing |
| `useKillsStore` | Session | `app/stores/kills.ts` | Kill tracking in round |
| `useVotesStore` | Session | `app/stores/votes.ts` | Deck/Play votes |
| `useCommandersStore` | Session | `app/stores/commanders.ts` | Commander per player |

---

## Setup API Pattern

```ts
export const useXxxStore = defineStore('xxx', () => {
  const items = ref<Item[]>([])
  const getById = computed(() => (id: number) => items.value.find(i => i.id === id) ?? null)
  async function fetchItems(force = false) { /* ... */ }
  return { items, getById, fetchItems }
})
```

- **State**: `ref()` instead of `state: () => ({ ... })`
- **Getters**: `computed()` instead of `getters: { ... }`
- **Actions**: plain functions instead of `actions: { ... }`
- Only returned values are accessible

---

## Supabase Stores

Common patterns: `initialized` flag, `loading` state, `error` state, optimistic local updates.

### `useLeagueStore`

**State**: `leagues`, `currentLeague`, `error`, `initialized`, `loadingFetch/Create/Update/Delete`, `loading` (computed)

**Getters**: `getLeagueById(id)`, `sortedLeagues` (by start date, newest first)

**Actions**: `fetchLeagues`, `createLeague`, `updateLeague`, `deleteLeague`, `setCurrentLeague`, `clearError`

---

### `useRulesetStore`

**State**: `rulesets`, `loading`, `error`, `initialized`

**Getters**: `getRulesetById(id)`

**Actions**: `fetchRulesets`, `createRuleset`, `updateRuleset`, `deleteRuleset` (checks league usage first), `clearError`

---

### `usePlayerStore`

**Utility**: `sanitizePlayer<T>(player: T): T` — replaces `_` with spaces in names.

**State**: `players` (sanitized), `waitingPlayers`, `waitroomEntries` (Map<playerId, insertedAt>), `loading`, `error`, `initialized`

**Getters**: `getPlayerById(id)`, `getPlayersByIds(ids)`, `searchPlayers(query)`

**Actions**: `fetchPlayers`, `createPlayer`, `updatePlayer`, `fetchWaitingPlayers`, `addToWaitingList`, `removeFromWaitingList`, `clearError`

---

### `usePlayerStatsStore`

**State**: `stats` (`PlayerStat[]`, from denormalized `player_stats` table), `initialized`, `loading`

**Actions**: `fetchStats(force)`, `getStat(playerId, key)` (returns 0 if not found), `reset`

---

### `useCommanderDeckStore`

**State**: `decks` (`CommanderDeck[]`), `loading`, `error`, `initialized`

**Getters**: `getDecksByPlayerId(playerId)`, `getDeckById(id)`

**Actions**: `fetchDecks(force)`, plus standard create/update/delete CRUD (see `app/stores/CLAUDE.md`)

---

### `useEventStore`

The most complex store. Uses `loadingCount` counter instead of boolean.

**State**: `events`, `currentEvent`, `standings`, `pairings`, `pairingHistory`, `loadingCount`, `loading` (computed), `error`, `initialized` (per-league Record)

**Helpers**: `beginLoading()`, `endLoading()`, `upsertRoundResult(pairingId, playerId, data)`

**Getters**: `getEventsByLeagueId(leagueId)`, `isEventEnded`

**Event Lifecycle**: `fetchEvents`, `createEvent`, `updateEvent`, `deleteEvent`, `startEvent` (validates 3+ players, not 5), `nextRound` (calculates scores, updates standings, creates pairings), `turnBackRound` (goes back or to registration), `setCurrentEvent`

**Round Data**: `createPairings` (round 1 uses `playerOrder`, 2+ uses optimizer), `fetchPairings`, `fetchPairingHistory`, `submitRoundResult`, `updateRoundResult`, `saveVote`, `saveCommander`, `savePairingRankings`, `savePairingKills`

**Standings**: `fetchStandings`, `fetchMultipleEventStandings`, `fetchLeagueStandings` (simple sum), `fetchLeagueResults` (ruleset scoring with participation bonus + tie-breakers)

**Score formula** (`nextRound`): `rankScore + kills × rule_set_kill + brew_votes × rule_set_brew + play_votes × rule_set_play`

---

## Session Stores

Ephemeral UI state for the event page. No Supabase calls. `Map<number, ...>` patterns. All have `reset()`.

### `useRankingsStore`

**Interface**: `RankingEntry { playerId, rank }`

**State**: `rankingsWithRanks` — `Map<pairingId, RankingEntry[]>`

**Getters**: `getRankingWithRanks(pairingId)`, `hasRanking(pairingId)`

**Actions**: `setRankingWithRanks`, `removeRanking`, `reset`

---

### `useKillsStore`

**Interface**: `Kill { killerId, victimId }`

**State**: `kills` (`Kill[]`), `confirmedPairings` (`Set<number>`)

**Getters**: `isKillPresent(killer, victim)`, `isReverseKillPresent`, `hasSuicided(playerId)`, `killsByKiller(killerId)`, `deathsByVictim(victimId)`, `isPairingConfirmed(pairingId)`

**Actions**: `addKill` (validates no duplicate/reverse, returns `{success, error?}`), `removeKill`, `confirmPairing`, `unconfirmPairing`, `reset`

---

### `useVotesStore`

**Interface**: `VoteEntry { playerId, deckVotePlayerId, playVotePlayerId }`

**State**: `votes` — `Map<playerId, VoteEntry>`

**Getters**: `getVotes(playerId)`, `getDeckVote(playerId)`, `getPlayVote(playerId)`, `hasVotes(playerId)`

**Actions**: `setVotes`, `setDeckVote`, `setPlayVote`, `removeVotes`, `reset`

---

### `useCommandersStore`

**Interface**: `CommanderEntry { playerId, commander1, commander2 }`

**State**: `commanders` — `Map<playerId, CommanderEntry>`

**Getters**: `getCommanders(playerId)`, `getCommander1(playerId)`, `getCommander2(playerId)`

**Actions**: `setCommanders`, `setCommander1`, `setCommander2`, `removeCommanders`, `reset`

---

## Patterns

### Composables
Wrap store calls in `useAsyncData` for SSR:

```ts
const { data, pending, error } = useAsyncData('key', async () => {
  await store.fetchItems()
  return store.items
})
```

### Error Handling
```ts
try {
  const { data, error: supaError } = await supabase.from('table').select('*')
  if (supaError) throw supaError
} catch (err) {
  error.value = err instanceof Error ? err.message : 'Fallback'
  console.error('[useXxxStore] actionName error:', err)
  return { success: false, error: error.value }
} finally {
  loading.value = false // or endLoading()
}
```

### Architecture
1. **Setup API exclusively** — better TS inference, explicit public API
2. **Two categories** — Supabase for persistent data, Session for ephemeral UI state
3. **Loading strategies** — per-action booleans (`leagues`) vs counter (`events`)
4. **Composables as orchestrators** — SSR support, stores manage actual state
5. **Initialization flags** — prevent duplicate fetches on navigation
6. **Optimistic updates** — local state updated immediately after successful mutation

See [`PROGRESS.md`](../PROGRESS.md) for high-level architecture overview.
