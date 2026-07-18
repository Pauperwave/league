# Pinia Stores

5 stores using the **Setup API** pattern: 1 lifecycle store (persistent, BFF-backed) + 4 Session (ephemeral). All other domains (leagues, rulesets, players, player stats, commander decks, deck/commander stats, match history) have migrated to Pinia Colada query composables (ADR-015) — see `docs/architecture/async-data-keys.md` for their query keys and `app/composables/CLAUDE.md` for the pattern.

| Store | Type | File | Purpose |
|-------|------|------|---------|
| `useEventStore` | Lifecycle | `app/stores/events.ts` | Event lifecycle state machine (registration → playing → ended), round scoring |
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

## The Lifecycle Store

### `useEventStore`

The event lifecycle state machine — `currentEvent` + BFF `$fetch` actions + the ADR-007 `save*` seam. No Supabase client, no read caches (those live in `event/useEventQueries.ts` / `league/useLeagueStandingsQuery.ts`, refreshed by `useEventPage.refreshAfterLifecycle()`).

**State**: `currentEvent`, `loading` (computed from `loadingCount`), `error`

**Getters**: `isEventEnded`

**Event Lifecycle**: `startEvent` (validates 3+ players, not 5), `nextRound` (server scores the round, advances or ends the event, inserts next pairings), `turnBackRound` (rolls back a round or to registration), `setCurrentEvent`. Plain CRUD (`createEvent`/`updateEvent`/`deleteEvent`) lives in `event/useEventMutations.ts` instead — a Colada `useMutation` per action, same template as leagues/rulesets/decks/players.

**Round writes** (ADR-007 `save*` seam, each a direct BFF `$fetch`): `saveVote`, `saveCommander`, `savePairingRankings`, `savePairingKills`

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

### Colada query composables (all non-lifecycle domains)
Reads live in `useQuery` composables, not stores — see `app/composables/CLAUDE.md`'s "Colada domains" note and `docs/architecture/async-data-keys.md` for the key inventory:

```ts
export function useXxxQuery(id: number) {
  const supabase = useSupabaseClient()
  return useQuery({
    key: ['xxx', id],
    query: async () => {
      const { data, error } = await supabase.from('xxx').select('*').eq('id', id)
      if (error) throw error
      return data
    },
  })
}
```

### Error Handling (lifecycle store + session stores)
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
2. **Two remaining categories** — the lifecycle store (`events.ts`, BFF-backed state machine) and Session stores (ephemeral UI state); every other domain reads/writes through Colada query/mutation composables instead
3. **Loading strategy** — `events.ts` uses a `loadingCount` counter since its actions nest; Colada composables expose `isLoading` per query
4. **Composables as the read layer** — Colada's `useQuery` handles SSR + caching directly; no `useAsyncData` wrapper needed
5. **Query keys as initialization** — Colada's own cache replaces the old per-store `initialized` flag pattern
6. **Optimistic updates** — Colada mutations invalidate + refetch rather than hand-patching local state (see `app/composables/CLAUDE.md`)

See [`PROGRESS.md`](../PROGRESS.md) for high-level architecture overview.
