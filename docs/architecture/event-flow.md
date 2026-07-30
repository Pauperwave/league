# Tournament Flow / Lifecycle

<!-- docs/architecture/event-flow.md -->

Documentation of the tournament lifecycle from creation through completion.

## Tournament States

A tournament exists in one of three states, derived from DB columns:

| State | `tournament_playing` | `tournament_current_round` | `tournament_registration_open` | Description |
|-------|-----------------|----------------------|---------------------------|-------------|
| **registration** | `false` | `0` | `true` (default) | Players can join via waitroom. No pairings exist. |
| **playing** | `true` | `1..N` | `false` | Active rounds. Pairings and standings exist. |
| **ended** | `false` | `N` | `false` | All rounds completed. Standings are final. |

> The `tournaments.status` column is a **generated column** computed from `tournament_current_round` vs `tournament_round_number`. See `docs/architecture/database.md` for trigger details.

---

## Lifecycle Phases

### 1. Creation

**Trigger:** League detail page → "Crea Torneo" button

**DB mutations:**
- Insert row into `tournaments` with `tournament_playing = false`, `tournament_current_round = 0`, `tournament_registration_open = true`

**Not a lifecycle action** — plain CRUD via Colada: `useTournamentMutations().createTournament.mutateAsync(payload)` → `POST /api/tournaments/create`, invalidates the tournament-list query on settle. (Lifecycle actions — start/next/turn-back-round below — are the only tournament writes that go through `useTournamentStore` instead.)

---

### 2. Registration

**UI:** `TournamentActionBar` shows stepper with "Registrazione" step active.

**Actions available:**
- **Add player to waitroom:** `useTournamentPage()`'s `addToWaitingList(playerIds)` → `useWaitroomMutations(tournamentId).registerPlayers.mutateAsync(playerIds)` (Colada) → `POST /api/tournaments/:id/register-player` → inserts into `waitroom`
- **Remove player from waitroom:** `removeFromWaitingList(playerIds)` → `unregisterPlayers.mutateAsync(playerIds)` → `POST /api/tournaments/:id/unregister-player` → deletes from `waitroom`
- **Create new player:** `CreatePlayerModal` → adds to `players` table (Colada `usePlayerMutations`), then adds to waitroom
- **Preview tables:** Shows estimated table distribution (4-player / 3-player tables) based on waitroom count

**Validation for start:**
- Minimum 3 players
- Cannot start with exactly 5 players

**Data source:** `useWaitroom(tournamentId)` (Colada query, `['waitroom', tournamentId]`) exposes `waitingPlayers` (array of `player_id`s) and `waitroomEntries` (full waitroom rows with timestamps).

---

### 3. Start Tournament

**Trigger:** "Avvia Torneo" button in `TournamentActionBar`

**Precondition:** `canStartTournament` computed (≥3 players, ≠5 players)

**DB mutations (transaction-like sequence):**

1. Read all `waitroom` rows for this tournament
2. Validate player order (if custom order provided, must match waitroom players exactly)
3. **Insert standings:** One row per player into `standings` with `standing_player_score = 0`, `victories = 0`, `brew_received = 0`, `play_received = 0`
4. **Update tournament:** `tournament_playing = true`, `tournament_current_round = 1`, `tournament_registration_open = false`
5. **Clear waitroom:** Delete all `waitroom` rows for this tournament
6. **Create pairings:** Insert `pairings` rows for round 1 (table assignment by sequential slice of player order)

**Store action:** `useTournamentStore.startTournament(tournamentId, playerOrder?)` — single atomic BFF call, all 6 mutations above happen server-side in one request.

**After start — `refreshAfterLifecycle()`** (in `useTournamentPage.ts`, called by every lifecycle action): refetches/invalidates exactly the Colada queries this transition touches — the tournament-list query (`useEventsQuery`), standings (`useEventStandingsQuery`), waitroom (`useWaitroom`), and invalidates the pairings/pairing-history query keys for this tournament. The store's own `currentTournament` is already fresh from `startTournament`'s own server response — no separate refetch needed for it.

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

**DB mutations:** upsert into `round_results` (by `pairing_id`+`player_id`) via `server/utils/roundResults.ts`'s shared `upsertRoundResult` — four narrow endpoints, not a generic round-result CRUD:

**Store actions** (`useTournamentStore`'s ADR-007 `save*` seam, each a direct BFF `$fetch`, called from `useTournamentSubmitHandlers.ts`'s modal submit handlers):
- `savePairingRankings(pairingId, rankings)` → `POST /api/pairings/:id/rankings`
- `savePairingKills(pairingId, kills)` → `POST /api/pairings/:id/kills`
- `saveCommander(pairingId, playerId, commander1, commander2?)` → `POST /api/pairings/:id/commander`
- `saveVote(pairingId, playerId, brewVote, playVote)` → `POST /api/pairings/:id/votes`

#### 4b. Next Round

**Trigger:** "Prossimo Round" button in `TournamentActionBar`

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
8. **Increment round:** `tournament_current_round += 1`
9. **Check if ended:** If new round > `tournament_round_number`
   - **Ended:** Set `tournament_playing = false` (no new pairings)
   - **Continue:** Generate pairings for next round via optimizer

**Pairing generation (rounds 2+):**
- Fetches standings + historical pairings
- Runs `pairingOptimizer` (greedy seed + local swap)
- Constraints: balanced tables (3p/4p), no rematches, spread skill levels
- Inserts new `pairings` rows

**Store action:** `useTournamentStore.nextRound(tournamentId, currentRound, playerOrder?)`

**Auto-triggers:**
- Denormalized stats tables (`player_stats`, `deck_stats`) recalculated via DB trigger on `round_results` INSERT/UPDATE/DELETE
- `commander_stats` materialized view refreshed

---

### 5. Turn Back Round

**Trigger:** "Torna Indietro" button in `TournamentActionBar`

**Behavior depends on current round:**

| Current Round | Action |
|---------------|--------|
| Round > 1 | Decrement `tournament_current_round`, delete pairings for current round |
| Round 1 | Reset to **registration**: `tournament_playing = false`, `tournament_current_round = 0`, `tournament_registration_open = true`, delete all standings + pairings, restore players to waitroom |

**Store action:** `useTournamentStore.turnBackRound(tournamentId, currentRound)` — same `refreshAfterLifecycle()` pattern as start/nextRound.

---

### 6. Ended

**Trigger:** Automatic when `nextRound` increments past `tournament_round_number`

**State:** `tournament_playing = false`, `tournament_current_round = total_rounds`

**UI:** `TournamentActionBar` shows "Torneo Terminato". Standings are read-only.

---

## State Diagram

```
[Created] ──► [Registration]
                   │
                   │ "Avvia Torneo"
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
| `useTournamentPage()` | Orchestrates all tournament data, exposes lifecycle actions |
| `useTournamentUrl()` | Syncs URL query params with tournament phase/round/modals |
| `useLiveStandings()` | Reactive standings computation from pairings + results |
| `useTableCalculator()` | Table size estimation and preview table generation |
| `usePairingPresets()` | Saved player order presets for quick start |

## Key Components

| Component | Used In | Purpose |
|-----------|---------|---------|
| `TournamentActionBar` | Tournament page | Stepper + action buttons (start, next, back) |
| `WaitingList` | Tournament page (registration) | Player list with add/remove |
| `StandingsCard` | Tournament page | Live standings table |
| `PairingsCard` | Tournament page | Table cards with score submission |
| `TableScoreGrid` | Modal | Score entry form per table |
| `TablePreviewModal` | Modal | Preview table assignments before start |
| `NextRoundModal` | Modal | Confirm round advancement |
| `CommanderModal` | Modal | Select commander for a player |

## Related Docs

- `docs/architecture/state-flow.md` — General Colada/BFF data-flow architecture (what's a store vs. a Colada query/mutation, and why)
- `docs/architecture/database.md` — Trigger architecture, denormalized stats
- `docs/architecture/modal-url-sync.md` — URL query param sync for modals
- `docs/architecture/async-data-keys.md` — Data fetching keys for tournament page
