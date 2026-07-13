# Event Flow / Lifecycle

<!-- docs/architecture/event-flow.md -->

Documentation of the event lifecycle from creation through completion.

## Event States

An event exists in one of three states, derived from DB columns:

| State | `event_playing` | `event_current_round` | `event_registration_open` | Description |
|-------|-----------------|----------------------|---------------------------|-------------|
| **registration** | `false` | `0` | `true` (default) | Players can join via waitroom. No pairings exist. |
| **playing** | `true` | `1..N` | `false` | Active rounds. Pairings and standings exist. |
| **ended** | `false` | `N` | `false` | All rounds completed. Standings are final. |

> The `events.status` column is a **generated column** computed from `event_current_round` vs `event_round_number`. See `docs/architecture/database.md` for trigger details.

---

## Lifecycle Phases

### 1. Creation

**Trigger:** League detail page → "Crea Evento" button

**DB mutations:**
- Insert row into `events` with `event_playing = false`, `event_current_round = 0`, `event_registration_open = true`

**Store action:** `useEventStore.createEvent(leagueId, eventData)`

---

### 2. Registration

**UI:** `EventControlPanel` shows stepper with "Registrazione" step active.

**Actions available:**
- **Add player to waitroom:** `playerStore.addToWaitingList(eventId, playerId)` → inserts into `waitroom`
- **Remove player from waitroom:** `playerStore.removeFromWaitingList(eventId, playerId)` → deletes from `waitroom`
- **Create new player:** `CreatePlayerModal` → adds to `players` table, then adds to waitroom
- **Preview tables:** Shows estimated table distribution (4-player / 3-player tables) based on waitroom count

**Validation for start:**
- Minimum 3 players
- Cannot start with exactly 5 players

**Store data:**
- `playerStore.waitingPlayers` — array of `player_id`s
- `playerStore.waitroomEntries` — full waitroom rows with timestamps

---

### 3. Start Event

**Trigger:** "Avvia Evento" button in `EventControlPanel`

**Precondition:** `canStartEvent` computed (≥3 players, ≠5 players)

**DB mutations (transaction-like sequence):**

1. Read all `waitroom` rows for this event
2. Validate player order (if custom order provided, must match waitroom players exactly)
3. **Insert standings:** One row per player into `standings` with `standing_player_score = 0`, `victories = 0`, `brew_received = 0`, `play_received = 0`
4. **Update event:** `event_playing = true`, `event_current_round = 1`, `event_registration_open = false`
5. **Clear waitroom:** Delete all `waitroom` rows for this event
6. **Create pairings:** Insert `pairings` rows for round 1 (table assignment by sequential slice of player order)

**Store action:** `useEventStore.startEvent(eventId, playerOrder?)`

**Post-start data fetch:**
- `fetchEvents(leagueId)` — refresh event list
- `fetchPairings(eventId, 1)` — load round 1 pairings
- `fetchStandings(eventId)` — load initial standings
- `fetchWaitingPlayers(eventId)` — confirm waitroom cleared

---

### 4. Playing — Round Cycle

Each round follows this pattern:

#### 4a. Score Submission

**UI:** `PairingsCard` → click table → `TableScoreGrid` modal

**Per-player form:**
- Position (1st–4th)
- Kills (number)
- Commander selection (`CommanderModal`)
- Brew vote (best deck)
- Play votes (best play ×2)

**DB mutations:**
- Insert into `round_results` (one per player at the table)
- Update `pairings` status to indicate completion

**Store actions:**
- `submitRoundResult(pairingId, playerId, data)` — insert
- `updateRoundResult(pairingId, playerId, data)` — upsert
- `saveCommander(playerId, commanderName)` — update `commander_decks` if new

#### 4b. Next Round

**Trigger:** "Prossimo Round" button in `EventControlPanel`

**Precondition:** All tables in current round have submitted scores.

**DB mutations:**

1. **Fetch ruleset** (from league → ruleset join) for scoring weights
2. **Fetch pairings** for current round
3. **Fetch all round_results** for those pairings
4. **Fetch current standings**
5. **Calculate scores in memory:**
   ```
   score = rank_points + kills × kill_weight + brew_votes × brew_weight + play_votes × play_weight
   ```
   - Tied positions: average the rank points
   - `victories` incremented if position === 1
6. **Batch update standings** (score, victories, brew_received, play_received)
7. **Update ranks** (sort by score descending, assign `standing_player_rank`)
8. **Increment round:** `event_current_round += 1`
9. **Check if ended:** If new round > `event_round_number`
   - **Ended:** Set `event_playing = false` (no new pairings)
   - **Continue:** Generate pairings for next round via optimizer

**Pairing generation (rounds 2+):**
- Fetches standings + historical pairings
- Runs `pairingOptimizer` (greedy seed + local swap)
- Constraints: balanced tables (3p/4p), no rematches, spread skill levels
- Inserts new `pairings` rows

**Store action:** `useEventStore.nextRound(eventId, currentRound, playerOrder?)`

**Auto-triggers:**
- Denormalized stats tables (`player_stats`, `deck_stats`) recalculated via DB trigger on `round_results` INSERT/UPDATE/DELETE
- `commander_stats` materialized view refreshed

---

### 5. Turn Back Round

**Trigger:** "Torna Indietro" button in `EventControlPanel`

**Behavior depends on current round:**

| Current Round | Action |
|---------------|--------|
| Round > 1 | Decrement `event_current_round`, delete pairings for current round |
| Round 1 | Reset to **registration**: `event_playing = false`, `event_current_round = 0`, `event_registration_open = true`, delete all standings + pairings, restore players to waitroom |

**Store action:** `useEventStore.turnBackRound(eventId, currentRound, leagueId)`

---

### 6. Ended

**Trigger:** Automatic when `nextRound` increments past `event_round_number`

**State:** `event_playing = false`, `event_current_round = total_rounds`

**UI:** `EventControlPanel` shows "Evento Terminato". Standings are read-only.

---

## State Diagram

```
[Created] ──► [Registration]
                   │
                   │ "Avvia Evento"
                   ▼
              [Round 1 Playing] ◄────┐
                   │                   │
         "Prossimo Round"              │
                   │                   │
                   ▼                   │ "Torna Indietro"
              [Round 2 Playing] ──────┤
                   │                   │
                   │ ...                │
                   ▼                   │
              [Round N Playing] ──────┘
                   │
         (auto when round > total)
                   ▼
                [Ended]
                   │
         "Torna Indietro" (from round 1)
                   │
                   ▼
              [Registration]
```

---

## Key Composables

| Composable | Responsibility |
|------------|---------------|
| `useEventPage()` | Orchestrates all event data, exposes lifecycle actions |
| `useEventUrl()` | Syncs URL query params with event phase/round/modals |
| `useLiveStandings()` | Reactive standings computation from pairings + results |
| `useTableCalculator()` | Table size estimation and preview table generation |
| `usePairingPresets()` | Saved player order presets for quick start |

## Key Components

| Component | Used In | Purpose |
|-----------|---------|---------|
| `EventControlPanel` | Event page | Stepper + action buttons (start, next, back) |
| `WaitingList` | Event page (registration) | Player list with add/remove |
| `StandingsCard` | Event page | Live standings table |
| `PairingsCard` | Event page | Table cards with score submission |
| `TableScoreGrid` | Modal | Score entry form per table |
| `TablePreviewModal` | Modal | Preview table assignments before start |
| `NextRoundModal` | Modal | Confirm round advancement |
| `CommanderModal` | Modal | Select commander for a player |

## Related Docs

- `docs/architecture/database.md` — Trigger architecture, denormalized stats
- `docs/architecture/modal-url-sync.md` — URL query param sync for modals
- `docs/architecture/async-data-keys.md` — Data fetching keys for event page
