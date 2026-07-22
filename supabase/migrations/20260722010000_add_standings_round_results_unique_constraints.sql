-- Migration: idempotency guards for standings/round_results (BACKLOG #12)
-- Created: 2026-07-22
--
-- Neither table had a DB-level uniqueness constraint — only a client-trusted
-- "is the round what you think" comparison (TOCTOU, not a lock). This
-- already manifested as real duplicate rows in production (round_results,
-- pairing_id 1152, cleaned up before this migration) inflating
-- samePositionCount in calculateRoundScores for every player at that table.
--
-- start.post.ts must catch a unique-violation on the standings insert and
-- turn it into a clean 409, not a raw 500. upsertRoundResult (server/utils/
-- roundResults.ts) switches to a real atomic .upsert(onConflict: ...)
-- instead of a select-then-insert-or-update race.

ALTER TABLE standings
  ADD CONSTRAINT standings_event_id_player_id_key UNIQUE (event_id, player_id);

ALTER TABLE round_results
  ADD CONSTRAINT round_results_pairing_id_player_id_key UNIQUE (pairing_id, player_id);
