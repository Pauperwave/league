# Design: Multi-Device Real-Time Event Data Entry

**Date:** 2026-05-27
**Status:** Draft (pending review)

---

## 1. Goal

Enable real-time, multi-device data entry and viewing for Magic: The Gathering league events. The system must support:

- **Now:** Admin enters all data on one device, and all other devices (spectators, second screens) see live updates.
- **Future:** Players log in and enter their own Commander name and Votes. Admin sees who has submitted what in real-time.
- **Historical integrity:** When undoing a round ("Annulla round"), all previously-entered data for that round is visible and editable.

---

## 2. Current State

- Per-round data (rankings, kills, votes, commanders) is stored in **Pinia stores with `persist: true`** (localStorage via `pinia-plugin-persistedstate`).
- Data is only written to the database (`round_results` table) when the admin clicks "Avanti" (advance round) or "Termina evento".
- Live standings are calculated from the **in-memory Pinia stores**, not from the database.
- The system works perfectly for a single admin on a single device, but breaks for multiple devices because localStorage is device-local.

---

## 3. Proposed Architecture: Full Real-Time

### 3.1 Core Principle

**The database is the single source of truth for all round data.** Every action writes directly to Supabase. All connected devices receive updates via Supabase Realtime.

### 3.2 Data Flow

```
[Admin or Player Device]
    ↓ (INSERT/UPDATE round_results)
[Supabase Database]
    ↓ (Realtime broadcast)
[All Connected Devices]
    ↓ (Update Pinia stores)
[UI Re-renders with fresh data]
```

### 3.3 Why This Approach

- **Scales to unlimited devices:** Any device with the event page open sees the same data.
- **Survives refreshes:** Data is in the DB, not localStorage.
- **Future-proof:** When players get login accounts, they can write directly to the same table with the same real-time sync.
- **Historical data:** `round_results` rows are permanent. Going back a round simply fetches the existing rows for that round number.

---

## 4. Database Schema Changes

### 4.1 Existing Table: `round_results`

Already contains all needed columns:

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | `bigint` | NO | PK |
| `player_id` | `bigint` | NO | FK → players |
| `pairing_id` | `bigint` | YES | FK → pairings |
| `position` | `smallint` | YES | Table ranking (1-4) |
| `number_of_kills` | `smallint` | YES | Kills this round |
| `brew_vote` | `bigint` | YES | FK player_id voted for best deck |
| `play_vote_1` | `bigint` | YES | FK player_id best play vote 1 |
| `play_vote_2` | `bigint` | YES | FK player_id best play vote 2 |
| `commander_1` | `text` | YES | Commander card name |
| `commander_2` | `text` | YES | Second commander card name |

### 4.2 Required Change: Composite Unique Constraint

Add a unique constraint on `(pairing_id, player_id)` to enable safe `.upsert()` operations.

```sql
ALTER TABLE round_results
ADD CONSTRAINT unique_round_result_pairing_player
UNIQUE (pairing_id, player_id);
```

**Rationale:** When multiple devices write concurrently (e.g., admin updates ranking while player updates commander), `.upsert()` will update the existing row rather than creating duplicates.

### 4.3 Optional Change: Add `event_id` to `round_results`

Currently, to filter `round_results` by event, you must join through `pairings`. Adding `event_id` directly to `round_results` simplifies Realtime subscriptions.

```sql
ALTER TABLE round_results
ADD COLUMN event_id bigint REFERENCES events(event_id);
```

**Trade-off:** Slightly denormalized, but makes Realtime filtering much simpler (no need for client-side filtering by pairing_id).

**Decision:** Recommended. The simplicity of Realtime subscriptions outweighs the minor denormalization.

---

## 5. Pinia Store Changes

### 5.1 Current Stores to Modify

- `useRankingsStore`
- `useKillsStore`
- `useVotesStore`
- (Also `useCommandersStore` if it exists)

### 5.2 What Changes

1. **Remove `persist: true`** — localStorage is no longer the source of truth.
2. **Add Realtime subscription** — listen to `round_results` changes for the current event.
3. **Add hydration function** — fetch existing `round_results` for the current round and populate the store.
4. **Write function** — when data changes, call `.upsert()` to the DB immediately.

### 5.3 New Store Pattern

```typescript
// Example: useRankingsStore
export const useRankingsStore = defineStore('rankings', () => {
  const rankingsWithRanks = ref<Map<number, RankingEntry[]>>(new Map())
  let realtimeChannel: RealtimeChannel | null = null

  // Hydrate from DB when round changes
  async function hydrate(eventId: number, round: number) {
    const { data } = await supabase
      .from('round_results')
      .select('*, pairings!inner(pairing_round)')
      .eq('event_id', eventId)
      .eq('pairings.pairing_round', round)
    
    // Populate rankingsWithRanks from data
  }

  // Subscribe to realtime changes
  function subscribe(eventId: number) {
    realtimeChannel = supabase
      .channel(`round_results:event_${eventId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'round_results', filter: `event_id=eq.${eventId}` },
        (payload) => { /* update local state */ }
      )
      .subscribe()
  }

  // Write to DB immediately
  async function setRankingWithRanks(pairingId: number, ranking: RankingEntry[]) {
    // Update local state first (optimistic)
    rankingsWithRanks.value.set(pairingId, ranking)
    
    // Write to DB
    await supabase.from('round_results').upsert(
      ranking.map(entry => ({
        pairing_id: pairingId,
        player_id: entry.playerId,
        position: entry.rank,
      })),
      { onConflict: 'pairing_id,player_id' }
    )
  }

  function reset() {
    rankingsWithRanks.value.clear()
    realtimeChannel?.unsubscribe()
  }

  return { rankingsWithRanks, hydrate, subscribe, setRankingWithRanks, reset }
})
```

**Note:** No `persist` option. The DB is the source of truth.

---

## 6. Realtime Subscription Strategy

### 6.1 Channel Naming

```
round_results:event_<eventId>
```

### 6.2 Filtering

If `event_id` is added to `round_results`:
```typescript
.filter(`event_id=eq.${eventId}`)
```

If not, filter client-side by checking if the changed row's `pairing_id` belongs to the current event's pairings.

### 6.3 Handling Changes

On any `INSERT` or `UPDATE`:
1. Determine which pairing and player the row belongs to
2. Update the appropriate Pinia store (rankings, kills, votes, commanders)
3. The `useLiveStandings` composable automatically recalculates because it reads from reactive Pinia stores

### 6.4 Cleanup

When leaving the event page or changing rounds:
- Unsubscribe from the Realtime channel
- Clear the Pinia stores

---

## 7. Admin Flow Changes

### 7.1 Entering Data in Table Cards

**Current:** Data is stored in Pinia → localStorage. Only written to DB at round advance.

**New:** Every change triggers an immediate `.upsert()` to `round_results`.

Example: Admin sets the ranking for table 3.

```typescript
// In the table card component
async function onRankingChange(pairingId: number, ranking: RankingEntry[]) {
  // Optimistic update
  rankingsStore.setRankingWithRanks(pairingId, ranking)
  
  // Immediate DB write
  await supabase.from('round_results').upsert(
    ranking.map(entry => ({
      pairing_id: pairingId,
      player_id: entry.playerId,
      position: entry.rank,
    })),
    { onConflict: 'pairing_id,player_id' }
  )
}
```

### 7.2 Round Advance ("Avanti")

**Current:** Reads all local Pinia data, inserts into `round_results`, then calculates next round pairings.

**New:** Data is already in `round_results`. Round advance simply:
1. Calculates standings from `round_results` for the current round
2. Updates `standings` table
3. Creates new `pairings` for the next round
4. Increments `event_current_round`

**No batch insert needed** — data is already there.

### 7.3 Undo Round ("Annulla Round")

**Current:** Deletes `round_results` for the current round, reverts event state.

**New:** Same, but **data for the previous round is still in `round_results`** because it has a different `pairing_round`. When going back:
1. Decrement `event_current_round`
2. Fetch existing `round_results` for the now-current round
3. Hydrate Pinia stores
4. UI shows historical data exactly as it was entered

### 7.4 End Event ("Termina Evento")

**Current:** Final batch insert, set `event_playing = false`.

**New:** Just set `event_playing = false`. All data is already persisted.

---

## 8. Live Standings

### 8.1 Data Source

Currently: `useLiveStandings` reads from local Pinia stores.

**New:** Same composable, but the Pinia stores are now populated from the DB via Realtime. The calculation logic stays identical.

### 8.2 Calculation Trigger

- When Realtime pushes a change to `round_results`
- Pinia store updates
- `useLiveStandings` (computed) recalculates automatically
- All devices see the updated standings simultaneously

---

## 9. Submission Tracking UI (Admin View)

### 9.1 Purpose

Let the admin see which players at which tables have submitted their data.

### 9.2 Data Source

`round_results` rows for the current round. For each player, check:

- `commander_1 IS NOT NULL` → Commander entered
- `brew_vote IS NOT NULL` → Brew vote cast
- `play_vote_1 IS NOT NULL AND play_vote_2 IS NOT NULL` → Play votes cast
- `position IS NOT NULL` → Table ranking set

### 9.3 UI Design

A compact panel (maybe a slide-out or modal) showing:

```
Table 1
  ✅ Player A — Commander, Votes, Ranking
  ⚠️ Player B — Commander, Ranking (missing votes)
  ❌ Player C — (nothing submitted)
  ✅ Player D — All complete

Table 2
  ...
```

**Green checkmark:** All data complete
**Yellow warning:** Partial data
**Red X:** Nothing submitted

---

## 10. Future: Player-Driven Data Entry

### 10.1 Authentication

Players log in via Supabase Auth. Their `auth.users.id` is linked to their `players` record (likely via a new column `players.auth_user_id`).

### 10.2 RLS Policies

```sql
-- Players can only write their own round_results
CREATE POLICY "Players can update their own results"
ON round_results
FOR INSERT UPDATE
TO authenticated
USING (player_id IN (
  SELECT player_id FROM players WHERE auth_user_id = auth.uid()
))
WITH CHECK (player_id IN (
  SELECT player_id FROM players WHERE auth_user_id = auth.uid()
));

-- Players can only read round_results for events they're in
CREATE POLICY "Players can read their event results"
ON round_results
FOR SELECT
TO authenticated
USING (event_id IN (
  SELECT event_id FROM standings WHERE player_id IN (
    SELECT player_id FROM players WHERE auth_user_id = auth.uid()
  )
));
```

### 10.3 Player UI

A simplified view where a player sees:
- Their current table
- Input fields for: Commander name, Brew vote, Play votes
- Submit button (writes directly to `round_results`)
- Realtime updates show them when the admin has advanced the round

### 10.4 Same Realtime Benefits

- Admin sees player's submission instantly
- Other players at the same table can see votes as they're cast (if desired)
- No localStorage needed

---

## 11. Implementation Phases

### Phase 1: Foundation (No UI changes yet)
- Add composite unique constraint to `round_results`
- Optionally add `event_id` column to `round_results`
- Refactor Pinia stores to remove `persist`, add hydration/subscription/write functions
- Update `useLiveStandings` to work with the new reactive stores

### Phase 2: Realtime Admin Flow
- Update table card components to write incrementally to DB
- Update round advance logic (no more batch insert)
- Update undo round logic (hydrate from DB)
- Test real-time sync across multiple browser tabs

### Phase 3: Submission Tracking UI
- Build the admin panel showing who's submitted what
- Add real-time indicators to table cards (subtle badges showing completion)

### Phase 4: Future Player Auth (separate project)
- Build player login system
- Add `auth_user_id` to `players`
- Create player-facing data entry page
- Write RLS policies

---

## 12. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Concurrent writes overwrite each other | Composite unique constraint + `.upsert()` ensures only one row per player per pairing |
| Network latency makes UI feel slow | Optimistic updates in Pinia stores (update UI first, then DB) |
| Realtime subscription drops | Auto-reconnect is built into Supabase Realtime; add manual reconnect button if needed |
| Large events with many tables | Realtime channels support filtering; `event_id` column makes this efficient |
| Player sees partial data mid-entry | Each field is written independently; partial data is expected and valid during entry |

---

## 13. Success Criteria

- [ ] Admin enters data on Device A → Device B shows updated standings within 1 second
- [ ] After clicking "Annulla round", all historical data for the previous round is visible
- [ ] Refreshing the page on any device shows the current round's data (no loss)
- [ ] Multiple browser tabs editing the same event stay in sync
- [ ] No duplicate `round_results` rows are created under concurrent writes

---

## 14. Open Questions

1. Should `event_id` be added to `round_results` for simpler Realtime filtering?
2. Should kills be stored as a separate table (e.g., `round_kills`) instead of `number_of_kills` on `round_results`? (Currently, the kill graph is inferred from `number_of_kills`, but a proper graph structure might be needed for validation.)
3. Should the submission tracking UI be a persistent sidebar or a toggleable panel?
4. Do we need an "admin override" mode where the admin can edit any player's data even after the player has submitted?
