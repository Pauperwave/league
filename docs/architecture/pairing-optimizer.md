# Pairing optimizer

<!-- docs/architecture/pairing-optimizer.md -->

The algorithm behind "Ottimizza"/"Randomizza" in the table preview modal (`TablePreviewModal.vue`) and the "Dettaglio calcolo tavolo" score breakdown (`TableScoreBreakdownModal.vue`, `TableReceiptSummary.vue`, `TablePlayerReceiptCard.vue`). Core logic lives in `app/composables/event-pairing/pairingOptimizer.ts`; this doc explains what each score component means and — critically — **when it's supposed to be zero**, since that's repeatedly been mistaken for a bug (see `docs/TODO.md`'s 2026-08-04 entry).

## How optimization works

`optimizePairings()` runs 3 independent greedy-construction attempts (seeded by rank, by 3-table rotation need, and by score), each followed by a pairwise local-swap search within a time budget (default 120-220ms depending on caller). The best-scoring result across all 3 attempts is returned. Table sizes themselves come from `useTableCalculator.ts`'s `getTableSizes(playerCount)` — a pure function of total player count, always a mix of 4- and 3-player tables (or `[]`/unplayable for `< 3` or exactly `5` players, see the ADR below).

## The 5 score components

Every table's score, and every seated player's individual share of it, breaks down into exactly these 5 weighted components (`PairingTableScore`/`PairingPlayerScore` in `pairingOptimizer.ts`):

| Component | Measures | Scope | When it's legitimately `0.00` |
|---|---|---|---|
| **Bilanciamento** (`strengthBalance`) | How evenly matched the table is by tournament rank — smaller `maxRank - minRank` spread scores better. Table-level (no single owner), heuristically redistributed to players closer to the table average. | This table only | Never exactly 0 unless every seated player shares the same rank. |
| **Novità** (`novelty`) | +1 per pair of seated players who have **never** been at a table together before. | League-wide (see below) | All pairs at the table have already met, this tournament or another one in the league. |
| **Rematch** (`rematchPenalty`) | Penalty for pairs who *have* met before, weighted by how many times and — for meetings *this* tournament — how recently (`1 / (currentRound - lastRound)` decay). Meetings in other tournaments of the league add a flat, undecayed `+1` each. | League-wide (see below) | Nobody at this table has played anyone else at it, in this tournament or any other one in the league. |
| **Rotazione tavoli da 3** (`rotateTable3`) | Penalty for seating a player who's historically been shortchanged games by sitting at 3-player tables (they miss one match per round vs. a 4-player table). | **Only applies to 3-player tables** — `calculateTable3Penalty`/`distributeTable3Penalty` both hard-`return 0`/no-op when `table.length !== 3`. History itself is league-wide (see below). | **Always `0.00` for any 4-player table**, regardless of any seated player's history — there's no "3-table cost" to attribute when nobody's sitting at a 3-table right now. For a 3-player table, `0.00` means none of the 3 seated players have `table3Count > 0` in the league's history. |
| **Peso dimensione tavolo** (`tableSizeWeight`) | Flat bonus/penalty for the table's size itself (`weights.tableSize4`/`weights.tableSize3`), split evenly per seated player. | This table only | Only exactly `0.00` if the corresponding weight slider is set to `0`. |

**The invariant**: `sum(perPlayer[p].total for p in table) === tableScore.total`, always. `novelty`/`rematchPenalty`/`rotateTable3` are deliberately weighted *twice* — once per-pair/per-player at attribution, once more when the table-level total re-weights the raw count — see the file-header comment in `pairingOptimizer.ts` before "fixing" this; it's intentional, not double-counting.

## History scope: per-tournament vs. league-wide (important, easy to get backwards)

Every history signal the optimizer uses is **league-wide** — but each is assembled from *two* queries with different scopes, and only the current-tournament half carries round numbers, so only that half decays:

- **`usePairingHistoryQuery(tournamentId)`** (`useTournamentQueries.ts`) — feeds `novelty`/`rematchPenalty` via `buildRematchMap`, and (in `[tournamentId].vue`) the current tournament's own share of `table3Count`. Scoped to **only the current tournament**, because its `pairing_round` values are what the rematch recency decay (`1 / (currentRound - lastRound)`) is measured against.
- **`useLeagueRematchCountsQuery(leagueId, excludeTournamentId)`** (`useTournamentQueries.ts`) — feeds `rematchPenalty`/`novelty` too, as a raw `Map<pairKey, count>` of how many times each pair sat together in **every other tournament in the league**. Added **flat and undecayed** to the in-tournament penalty (`inTournamentCount + recencyFactor + leagueCount`) under the *same* `weights.rematch` — no extra slider, no `PairingWeights` field. Round numbers aren't comparable across tournaments and no tournament-date data exists for this, so there's nothing meaningful to decay by. A pair with league-wide history but no in-tournament history is **not novel**: it takes the rematch branch with `recencyFactor = 0`.
- **`useLeagueTable3CountsQuery(leagueId, excludeTournamentId)`** (`useTournamentQueries.ts`) — feeds `table3Count` → `rotateTable3`. Same "every other tournament in the league" scope, explicitly so round 1 (which has no rounds of its own yet) still inherits a real rotation-fairness signal instead of starting from zero every time (BACKLOG #20). Summed with the current tournament's own in-progress rounds in `[tournamentId].vue`'s `pairingPlayersForScoring` computed, not replaced by it. It filters on `pairing_is_full = false` (only 3-player tables); the rematch query deliberately does not (pairs from tables of any size count).

Both league-wide queries are async and gated by `previewLoading` in `[tournamentId].vue` — see the gotcha below.

Historically rematch was the one deliberate exception here, scoped to the current tournament only ("don't re-pair the same two people within one event"). That was reversed on 2026-08-04 (ADR-054): two players who met in a past tournament of this league now count as having met.

## Known gotchas (fixed, but worth knowing about)

- **Round 1 used to bypass the optimizer entirely.** `TablePreviewModal.vue`'s auto-open watcher called `randomizeTables()` instead of `runOptimizer()` whenever `currentRound === 1`, on the theory that there was no rotation signal yet — wrong for a recurring league, since `table3Count` already carries real cross-tournament history in from round 1. Fixed 2026-08-04 (see `docs/TODO.md`) by removing the special case; the optimizer now runs at every round, auto-open and manual button alike.
- **The league-wide queries are async and weren't tracked by any loading gate.** The generic page `loading` (`useTournamentPage.ts`) only covered `tournamentStore`/waitroom/events — not these queries — so the auto-optimize watcher could fire while `leagueTable3CountsData` was still `undefined`, silently optimizing with `table3Count: 0` for everyone even when real history existed. Fixed 2026-08-04: `leagueTable3CountsLoading` (and, since ADR-054, `leagueRematchCountsLoading`) is exposed and combined into a dedicated `previewLoading` passed to `TablePreviewModal`'s `:loading`, gating the auto-optimize watcher until both queries actually resolve.
- **`optimizePairings` used to return a spuriously "valid" empty result for unplayable player counts.** `getTableSizes()` returns `[]` for `< 3` or exactly `5` total players (no valid 3/4-seat split exists) — without a guard, every build attempt produced zero tables, and `scoreSolution([])`'s `for` loop never running left `totalScore: 0` (a *finite* score beating the initial `-Infinity`). The caller (`useTableDnd.ts`'s `runOptimizer`) only checked `Number.isFinite` before `replaceByPlayerOrder(result.tables.flat())`, so this silently wiped every seat assignment. Fixed 2026-08-04: `optimizePairings` now returns an explicit `{ tables: [], totalScore: -Infinity, tableScores: [] }` when `tableSizes` is empty. Regression test: `pairingOptimizer.test.ts`.
