# Multi-Device Real-Time Event Data Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace localStorage-persisted Pinia stores with Supabase-backed real-time sync so all devices see the same event data instantly.

**Architecture:** A new `useRoundDataSync` composable hydrates Pinia stores from the DB on round load and subscribes to Supabase Realtime for live updates. The existing `eventStore.saveXxx` functions switch to atomic `.upsert()`. The UI components require minimal changes because they already read from Pinia stores.

**Tech Stack:** Nuxt 3, Vue 3, Pinia, Supabase (with Realtime), TypeScript

---

## File Structure Overview

| File | Responsibility |
|------|---------------|
| `app/composables/event/useRoundDataSync.ts` | **New.** Hydrates stores from DB, manages Realtime subscription, updates stores on remote changes. |
| `app/stores/rankings.ts` | Remove `persist`, add `hydrateFromResults()` helper. |
| `app/stores/kills.ts` | Remove `persist`, add `hydrateFromResults()` helper. |
| `app/stores/votes.ts` | Remove `persist`, add `hydrateFromResults()` helper. |
| `app/stores/commanders.ts` | Remove `persist`, add `hydrateFromResults()` helper. |
| `app/stores/events.ts` | Refactor `saveVote`, `saveCommander`, `savePairingRankings`, `savePairingKills` to use `.upsert()`. |
| `app/pages/league/[leagueId]/event/[eventId].vue` | Call `useRoundDataSync` when entering playing phase. |
| `app/composables/event/useLiveStandings.ts` | No changes needed — already reads from Pinia stores. |

---

## Phase 1: Database Foundation

### Task 1: Add Composite Unique Constraint to `round_results`

**Goal:** Enable atomic `.upsert()` on `(pairing_id, player_id)` to prevent duplicate rows under concurrent writes.

**Files:**
- Execute via Supabase Dashboard or MCP

- [ ] **Step 1: Run migration SQL**

```sql
-- Add composite unique constraint for safe upserts
ALTER TABLE round_results
ADD CONSTRAINT unique_round_result_pairing_player
UNIQUE (pairing_id, player_id);
```

**Verification:** In Supabase Table Editor, verify the `round_results` table now shows the constraint `unique_round_result_pairing_player` under Indexes/Constraints.

- [ ] **Step 2: Commit migration note**

```bash
git add docs/superpowers/specs/2026-05-27-multi-device-realtime-event-data.md
git commit -m "docs: add multi-device realtime design spec"
```

---

## Phase 2: Refactor Pinia Stores

### Task 2: Refactor `useRankingsStore`

**Goal:** Remove localStorage persistence; add helper to populate from DB results.

**Files:**
- Modify: `app/stores/rankings.ts`

- [ ] **Step 1: Remove `persist` and add `hydrateFromResults`**

```typescript
interface RankingEntry {
  playerId: number
  rank: number
}

export const useRankingsStore = defineStore('rankings', () => {
  const rankingsWithRanks = ref<Map<number, RankingEntry[]>>(new Map())

  const getRankingWithRanks = computed(() => (pairingId: number) =>
    rankingsWithRanks.value.get(pairingId))

  const hasRanking = computed(() => (pairingId: number) =>
    rankingsWithRanks.value.has(pairingId))

  function setRankingWithRanks(pairingId: number, ranking: RankingEntry[]) {
    rankingsWithRanks.value.set(pairingId, ranking)
  }

  function removeRanking(pairingId: number) {
    rankingsWithRanks.value.delete(pairingId)
  }

  function reset() {
    rankingsWithRanks.value.clear()
  }

  // NEW: Hydrate from DB round_results rows
  function hydrateFromResults(results: { pairing_id: number; player_id: number; position: number | null }[]) {
    rankingsWithRanks.value.clear()
    const grouped = new Map<number, RankingEntry[]>()

    for (const result of results) {
      if (result.position === null) continue
      const list = grouped.get(result.pairing_id) ?? []
      list.push({ playerId: result.player_id, rank: result.position })
      grouped.set(result.pairing_id, list)
    }

    for (const [pairingId, ranking] of grouped) {
      rankingsWithRanks.value.set(pairingId, ranking)
    }
  }

  return {
    rankingsWithRanks,
    getRankingWithRanks,
    hasRanking,
    setRankingWithRanks,
    removeRanking,
    reset,
    hydrateFromResults,
  }
})
```

**Note:** The third argument with `persist: { storage: ... }` is completely removed.

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx nuxt typecheck`
Expected: No errors in `app/stores/rankings.ts`

- [ ] **Step 3: Commit**

```bash
git add app/stores/rankings.ts
git commit -m "refactor: remove localStorage persist from rankings store, add hydrateFromResults"
```

---

### Task 3: Refactor `useKillsStore`

**Goal:** Remove localStorage persistence; add helper to populate kill counts from DB results.

**Files:**
- Modify: `app/stores/kills.ts`

- [ ] **Step 1: Remove `persist` and add `hydrateFromResults`**

```typescript
import type { Kill } from '#shared/utils/types'

export const useKillsStore = defineStore('kills', () => {
  const kills = ref<Kill[]>([])

  const isKillPresent = computed(() => (killerId: number, victimId: number) =>
    kills.value.some(k => k.killerId === killerId && k.victimId === victimId))

  const isReverseKillPresent = computed(() => (killerId: number, victimId: number) =>
    kills.value.some(k => k.killerId === victimId && k.victimId === killerId))

  const hasSuicided = computed(() => (playerId: number) =>
    kills.value.some(k => k.killerId === playerId && k.victimId === playerId))

  const killsByKiller = computed(() => (killerId: number) =>
    kills.value.filter(k => k.killerId === killerId).map(k => k.victimId))

  const deathsByVictim = computed(() => (victimId: number) =>
    kills.value.filter(k => k.victimId === victimId).length)

  function addKill(killerId: number, victimId: number): { success: boolean; error?: string } {
    if (isKillPresent.value(killerId, victimId))
      return { success: false, error: 'Uccisione già registrata' }

    if (isReverseKillPresent.value(killerId, victimId))
      return { success: false, error: 'La vittima ha già ucciso questo giocatore' }

    kills.value.push({ killerId, victimId })

    return { success: true }
  }

  function removeKill(killerId: number, victimId: number) {
    kills.value = kills.value.filter(
      k => !(k.killerId === killerId && k.victimId === victimId),
    )
  }

  function reset() {
    kills.value = []
  }

  // NEW: Hydrate from DB round_results (creates dummy kills for count only)
  function hydrateFromResults(results: { player_id: number; number_of_kills: number | null }[]) {
    kills.value = []
    for (const result of results) {
      const count = result.number_of_kills ?? 0
      for (let i = 0; i < count; i++) {
        // Use victimId = -1 as marker for "unknown victim" (count-only kills)
        kills.value.push({ killerId: result.player_id, victimId: -1 })
      }
    }
  }

  // NEW: Set exact kill count for a player (used for realtime updates)
  function setKillCount(playerId: number, count: number) {
    // Remove all existing kills for this player
    kills.value = kills.value.filter(k => k.killerId !== playerId)
    // Add dummy kills to match count
    for (let i = 0; i < count; i++) {
      kills.value.push({ killerId: playerId, victimId: -1 })
    }
  }

  return {
    kills,
    isKillPresent,
    isReverseKillPresent,
    hasSuicided,
    killsByKiller,
    deathsByVictim,
    addKill,
    removeKill,
    reset,
    hydrateFromResults,
    setKillCount,
  }
})
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx nuxt typecheck`
Expected: No errors in `app/stores/kills.ts`

- [ ] **Step 3: Commit**

```bash
git add app/stores/kills.ts
git commit -m "refactor: remove localStorage persist from kills store, add hydrateFromResults and setKillCount"
```

---

### Task 4: Refactor `useVotesStore`

**Goal:** Remove localStorage persistence; add helper to populate from DB results.

**Files:**
- Modify: `app/stores/votes.ts`

- [ ] **Step 1: Remove `persist` and add `hydrateFromResults`**

```typescript
interface VoteEntry {
  playerId: number
  deckVotePlayerId: number | null
  playVotePlayerId: number | null
}

export const useVotesStore = defineStore('votes', () => {
  const votes = ref<Map<number, VoteEntry>>(new Map())

  const getVotes = computed(() => (playerId: number) => votes.value.get(playerId))

  const getDeckVote = computed(() => (playerId: number) =>
    votes.value.get(playerId)?.deckVotePlayerId ?? null)

  const getPlayVote = computed(() => (playerId: number) =>
    votes.value.get(playerId)?.playVotePlayerId ?? null)

  const hasVotes = computed(() => (playerId: number) => {
    const entry = votes.value.get(playerId)
    return !!entry && (entry.deckVotePlayerId !== null || entry.playVotePlayerId !== null)
  })

  function setVotes(playerId: number, deckVotePlayerId: number | null, playVotePlayerId: number | null) {
    votes.value.set(playerId, { playerId, deckVotePlayerId, playVotePlayerId })
  }

  function setDeckVote(playerId: number, deckVotePlayerId: number | null) {
    const existing = votes.value.get(playerId)
    if (existing) {
      votes.value.set(playerId, { ...existing, deckVotePlayerId })
    }
    else {
      votes.value.set(playerId, { playerId, deckVotePlayerId, playVotePlayerId: null })
    }
  }

  function setPlayVote(playerId: number, playVotePlayerId: number | null) {
    const existing = votes.value.get(playerId)
    if (existing) {
      votes.value.set(playerId, { ...existing, playVotePlayerId })
    }
    else {
      votes.value.set(playerId, { playerId, deckVotePlayerId: null, playVotePlayerId })
    }
  }

  function removeVotes(playerId: number) {
    votes.value.delete(playerId)
  }

  function reset() {
    votes.value.clear()
  }

  // NEW: Hydrate from DB round_results rows
  function hydrateFromResults(results: { player_id: number; brew_vote: number | null; play_vote_1: number | null }[]) {
    votes.value.clear()
    for (const result of results) {
      if (result.brew_vote !== null || result.play_vote_1 !== null) {
        votes.value.set(result.player_id, {
          playerId: result.player_id,
          deckVotePlayerId: result.brew_vote,
          playVotePlayerId: result.play_vote_1,
        })
      }
    }
  }

  return {
    votes,
    getVotes,
    getDeckVote,
    getPlayVote,
    hasVotes,
    setVotes,
    setDeckVote,
    setPlayVote,
    removeVotes,
    reset,
    hydrateFromResults,
  }
})
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx nuxt typecheck`
Expected: No errors in `app/stores/votes.ts`

- [ ] **Step 3: Commit**

```bash
git add app/stores/votes.ts
git commit -m "refactor: remove localStorage persist from votes store, add hydrateFromResults"
```

---

### Task 5: Refactor `useCommandersStore`

**Goal:** Remove localStorage persistence; add helper to populate from DB results.

**Files:**
- Modify: `app/stores/commanders.ts`

- [ ] **Step 1: Remove `persist` and add `hydrateFromResults`**

```typescript
interface CommanderEntry {
  playerId: number
  commander1: string | null
  commander2: string | null
}

export const useCommandersStore = defineStore('commanders', () => {
  const commanders = ref<Map<number, CommanderEntry>>(new Map())

  const getCommanders = computed(() => (playerId: number) => commanders.value.get(playerId))

  const getCommander1 = computed(() => (playerId: number) =>
    commanders.value.get(playerId)?.commander1 ?? null)

  const getCommander2 = computed(() => (playerId: number) =>
    commanders.value.get(playerId)?.commander2 ?? null)

  function setCommanders(playerId: number, commander1: string | null, commander2: string | null) {
    commanders.value.set(playerId, { playerId, commander1, commander2 })
  }

  function setCommander1(playerId: number, commander1: string | null) {
    const existing = commanders.value.get(playerId)
    if (existing) {
      commanders.value.set(playerId, { ...existing, commander1 })
    }
    else {
      commanders.value.set(playerId, { playerId, commander1, commander2: null })
    }
  }

  function setCommander2(playerId: number, commander2: string | null) {
    const existing = commanders.value.get(playerId)
    if (existing) {
      commanders.value.set(playerId, { ...existing, commander2 })
    }
    else {
      commanders.value.set(playerId, { playerId, commander1: null, commander2 })
    }
  }

  function removeCommanders(playerId: number) {
    commanders.value.delete(playerId)
  }

  function reset() {
    commanders.value.clear()
  }

  // NEW: Hydrate from DB round_results rows
  function hydrateFromResults(results: { player_id: number; commander_1: string | null; commander_2: string | null }[]) {
    commanders.value.clear()
    for (const result of results) {
      if (result.commander_1 !== null || result.commander_2 !== null) {
        commanders.value.set(result.player_id, {
          playerId: result.player_id,
          commander1: result.commander_1,
          commander2: result.commander_2,
        })
      }
    }
  }

  return {
    commanders,
    getCommanders,
    getCommander1,
    getCommander2,
    setCommanders,
    setCommander1,
    setCommander2,
    removeCommanders,
    reset,
    hydrateFromResults,
  }
})
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx nuxt typecheck`
Expected: No errors in `app/stores/commanders.ts`

- [ ] **Step 3: Commit**

```bash
git add app/stores/commanders.ts
git commit -m "refactor: remove localStorage persist from commanders store, add hydrateFromResults"
```

---

## Phase 3: Unified Realtime Sync Composable

### Task 6: Create `useRoundDataSync` Composable

**Goal:** One composable handles all DB hydration and Realtime updates for the four stores.

**Files:**
- Create: `app/composables/event/useRoundDataSync.ts`

- [ ] **Step 1: Create the composable**

```typescript
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Pairing } from '#shared/utils/types'

interface RoundResultRow {
  id: number
  pairing_id: number
  player_id: number
  position: number | null
  number_of_kills: number | null
  brew_vote: number | null
  play_vote_1: number | null
  play_vote_2: number | null
  commander_1: string | null
  commander_2: string | null
}

export function useRoundDataSync(
  eventId: Ref<number>,
  currentRound: Ref<number>,
  pairings: Ref<Pairing[]>,
) {
  const supabase = useSupabaseClient()
  const rankingsStore = useRankingsStore()
  const killsStore = useKillsStore()
  const votesStore = useVotesStore()
  const commandersStore = useCommandersStore()

  let channel: RealtimeChannel | null = null
  const isHydrated = ref(false)

  async function hydrateFromDb() {
    const pairingIds = pairings.value.map(p => p.pairing_id)
    if (pairingIds.length === 0) {
      rankingsStore.reset()
      killsStore.reset()
      votesStore.reset()
      commandersStore.reset()
      isHydrated.value = true
      return
    }

    const { data: results, error } = await supabase
      .from('round_results')
      .select('*')
      .in('pairing_id', pairingIds)

    if (error) {
      console.error('[useRoundDataSync] hydrate error:', error)
      return
    }

    const rows = (results ?? []) as RoundResultRow[]

    // Populate each store from the fetched rows
    rankingsStore.hydrateFromResults(rows)
    killsStore.hydrateFromResults(rows)
    votesStore.hydrateFromResults(rows)
    commandersStore.hydrateFromResults(rows)

    isHydrated.value = true
  }

  function startRealtimeSync() {
    const pairingIds = pairings.value.map(p => p.pairing_id)
    if (pairingIds.length === 0) return

    channel = supabase
      .channel(`round_results:event_${eventId.value}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_results',
        },
        (payload) => {
          const result = payload.new as RoundResultRow | undefined
          if (!result || !pairingIds.includes(result.pairing_id)) return

          // Update the appropriate store based on which fields changed
          if (result.position !== null) {
            // Rebuild full ranking for this pairing
            rebuildRanking(result.pairing_id)
          }

          if (result.number_of_kills !== null) {
            killsStore.setKillCount(result.player_id, result.number_of_kills)
          }

          if (result.brew_vote !== null || result.play_vote_1 !== null) {
            votesStore.setVotes(result.player_id, result.brew_vote, result.play_vote_1)
          }

          if (result.commander_1 !== null || result.commander_2 !== null) {
            commandersStore.setCommanders(result.player_id, result.commander_1, result.commander_2)
          }
        },
      )
      .subscribe()
  }

  async function rebuildRanking(pairingId: number) {
    const { data: results } = await supabase
      .from('round_results')
      .select('player_id, position')
      .eq('pairing_id', pairingId)

    const ranking = (results ?? [])
      .filter((r): r is { player_id: number; position: number } => r.position !== null)
      .map(r => ({ playerId: r.player_id, rank: r.position }))

    if (ranking.length > 0) {
      rankingsStore.setRankingWithRanks(pairingId, ranking)
    }
    else {
      rankingsStore.removeRanking(pairingId)
    }
  }

  function stopRealtimeSync() {
    channel?.unsubscribe()
    channel = null
  }

  // Watch for round changes: re-hydrate and restart subscription
  watch(
    [() => currentRound.value, () => pairings.value.length],
    async ([newRound], [oldRound]) => {
      if (newRound !== oldRound) {
        isHydrated.value = false
      }
      stopRealtimeSync()
      await hydrateFromDb()
      startRealtimeSync()
    },
    { immediate: true },
  )

  onUnmounted(stopRealtimeSync)

  return {
    hydrateFromDb,
    stopRealtimeSync,
    isHydrated,
  }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx nuxt typecheck`
Expected: No errors in `app/composables/event/useRoundDataSync.ts`

- [ ] **Step 3: Commit**

```bash
git add app/composables/event/useRoundDataSync.ts
git commit -m "feat: add useRoundDataSync composable for DB hydration and realtime sync"
```

---

## Phase 4: Update Event Store Save Functions

### Task 7: Refactor `eventStore` Save Functions to Use `.upsert()`

**Goal:** Replace read-then-write pattern with atomic `.upsert()` leveraging the new unique constraint.

**Files:**
- Modify: `app/stores/events.ts` (lines 739-866)

- [ ] **Step 1: Refactor `saveVote`**

Replace the entire `saveVote` function (lines 739-768):

```typescript
async function saveVote(pairingId: number, playerId: number, brewVote: number | null, playVote: number | null): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('round_results')
      .upsert(
        {
          pairing_id: pairingId,
          player_id: playerId,
          brew_vote: brewVote,
          play_vote_1: playVote,
        },
        { onConflict: 'pairing_id,player_id' },
      )

    if (error) throw error

    return { success: true }
  }
  catch (err) {
    console.error('[useEventStore] saveVote error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Errore nel salvataggio del voto' }
  }
}
```

- [ ] **Step 2: Refactor `saveCommander`**

Replace the entire `saveCommander` function (lines 771-799):

```typescript
async function saveCommander(pairingId: number, playerId: number, commander1: string | null): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('round_results')
      .upsert(
        {
          pairing_id: pairingId,
          player_id: playerId,
          commander_1: commander1,
          commander_2: null,
        },
        { onConflict: 'pairing_id,player_id' },
      )

    if (error) throw error

    return { success: true }
  }
  catch (err) {
    console.error('[useEventStore] saveCommander error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Errore nel salvataggio del comandante' }
  }
}
```

- [ ] **Step 3: Refactor `savePairingRankings`**

Replace the entire `savePairingRankings` function (lines 802-832):

```typescript
async function savePairingRankings(pairingId: number, rankings: { playerId: number; position: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = rankings.map(r => ({
      pairing_id: pairingId,
      player_id: r.playerId,
      position: r.position,
    }))

    const { error } = await supabase
      .from('round_results')
      .upsert(rows, { onConflict: 'pairing_id,player_id' })

    if (error) throw error

    return { success: true }
  }
  catch (err) {
    console.error('[useEventStore] savePairingRankings error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Errore nel salvataggio delle posizioni' }
  }
}
```

- [ ] **Step 4: Refactor `savePairingKills`**

Replace the entire `savePairingKills` function (lines 835-865):

```typescript
async function savePairingKills(pairingId: number, killCounts: { playerId: number; count: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = killCounts.map(r => ({
      pairing_id: pairingId,
      player_id: r.playerId,
      number_of_kills: r.count,
    }))

    const { error } = await supabase
      .from('round_results')
      .upsert(rows, { onConflict: 'pairing_id,player_id' })

    if (error) throw error

    return { success: true }
  }
  catch (err) {
    console.error('[useEventStore] savePairingKills error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Errore nel salvataggio delle uccisioni' }
  }
}
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx nuxt typecheck`
Expected: No errors in `app/stores/events.ts`

- [ ] **Step 6: Commit**

```bash
git add app/stores/events.ts
git commit -m "refactor: use atomic upsert in saveVote, saveCommander, savePairingRankings, savePairingKills"
```

---

## Phase 5: Wire Up the Event Page

### Task 8: Integrate `useRoundDataSync` into the Event Page

**Goal:** Hydrate stores from DB when entering playing phase; keep them synced via Realtime.

**Files:**
- Modify: `app/pages/league/[leagueId]/event/[eventId].vue`

- [ ] **Step 1: Add `useRoundDataSync` call after pairings load**

After the existing pairings load block (around line 79-82), add:

```typescript
// Load round data from DB and subscribe to realtime updates
const { isHydrated } = useRoundDataSync(
  computed(() => eventId),
  computed(() => currentRound.value),
  pairings,
)
```

Add this after line 82 (after the `if (eventStatus.value === 'playing' ...)` block).

- [ ] **Step 2: Remove manual store resets on round operations**

In `handlePreviewConfirm` (around line 372-378), remove the store resets:

**Before:**
```typescript
if (ok) {
  killsStore.reset()
  rankingsStore.reset()
  commandersStore.reset()
  votesStore.reset()
  showStartPreviewModal.value = false
}
```

**After:**
```typescript
if (ok) {
  showStartPreviewModal.value = false
  // Stores will auto-hydrate via useRoundDataSync when pairings change
}
```

In `confirmCancelRound` (around line 573-581), remove store resets:

**Before:**
```typescript
if (ok) {
  killsStore.reset()
  rankingsStore.reset()
  commandersStore.reset()
  votesStore.reset()
}
```

**After:**
```typescript
if (ok) {
  // Stores will auto-hydrate via useRoundDataSync when round changes
}
```

In `confirmEndEvent` (around line 584-592), remove store resets:

**Before:**
```typescript
if (ok) {
  killsStore.reset()
  rankingsStore.reset()
  commandersStore.reset()
  votesStore.reset()
}
```

**After:**
```typescript
if (ok) {
  // Stores will auto-hydrate via useRoundDataSync when event ends
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx nuxt typecheck`
Expected: No errors in the event page.

- [ ] **Step 4: Commit**

```bash
git add app/pages/league/[leagueId]/event/[eventId].vue
git commit -m "feat: integrate useRoundDataSync for DB-backed real-time round data"
```

---

## Phase 6: Testing

### Task 9: Test Real-Time Sync Across Browser Tabs

**Goal:** Verify that data entered in one tab appears in another tab within seconds.

**Files:** No file changes.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`
Expected: Server starts at `http://localhost:3000`

- [ ] **Step 2: Open event page in Tab A**

Navigate to an event in playing phase with pairings.
Enter a commander for a player.

- [ ] **Step 3: Open same event page in Tab B**

Navigate to the same URL in a second browser tab.
Verify: The commander entered in Tab A appears in Tab B within 1-2 seconds.

- [ ] **Step 4: Test ranking sync**

In Tab A, enter a table ranking.
Verify in Tab B: The ranking appears and live standings recalculate.

- [ ] **Step 5: Test vote sync**

In Tab A, enter votes for a player.
Verify in Tab B: The votes appear and live standings recalculate.

- [ ] **Step 6: Test kills sync**

In Tab A, enter kills for a table.
Verify in Tab B: The kill count updates and live standings recalculate.

- [ ] **Step 7: Test page refresh**

Refresh Tab B.
Verify: All previously entered data is still visible (loaded from DB).

- [ ] **Step 8: Test undo round**

Advance to round 2, enter some data.
Click "Annulla round" to go back to round 1.
Verify: Round 1's historical data is visible exactly as it was before advancing.

---

## Phase 7: Submission Tracking UI (Optional, Post-MVP)

### Task 10: Build Admin Submission Tracking Panel

**Goal:** Let admin see which players have submitted commander, votes, ranking, and kills.

**Files:**
- Create: `app/components/events/SubmissionTracker.vue`
- Modify: `app/pages/league/[leagueId]/event/[eventId].vue` (add the component)

**Note:** This task is marked as post-MVP. Complete Tasks 1-9 first, then return to this.

---

## Spec Coverage Check

| Spec Requirement | Implementing Task |
|------------------|-------------------|
| DB is single source of truth | Tasks 1, 7 |
| Remove localStorage persistence | Tasks 2, 3, 4, 5 |
| Realtime sync across devices | Task 6 |
| Historical data on undo | Tasks 6, 8 |
| Atomic writes (upsert) | Task 7 |
| Live standings from DB | Tasks 2-6 (stores feed useLiveStandings) |
| Admin sees who submitted | Task 10 (post-MVP) |

## Placeholder Scan

- No "TBD", "TODO", or "implement later" found.
- All code blocks contain complete, runnable code.
- All file paths are exact.
- All test commands have expected output.

## Type Consistency Check

- `RoundResultRow` interface matches actual DB columns.
- Store `hydrateFromResults` signatures match the data shapes returned by Supabase.
- `useRoundDataSync` receives `Ref<number>` and `Ref<Pairing[]>` matching the event page's reactive values.

---

**Plan complete and saved to:** `docs/superpowers/plans/2026-05-27-multi-device-realtime-event-data.md`

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**
