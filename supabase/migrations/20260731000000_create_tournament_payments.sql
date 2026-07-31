-- Migration: Add tournament_payments table to persist how each player paid
-- Created: 2026-07-31
--
-- The waiting-list "Pagato" checkbox (POS/Contanti button group as of
-- 2026-07-31) was ephemeral by design (localStorage only, cleared the
-- moment the tournament starts — see useWaitingListFlags.ts) since it was
-- originally "just for remembering right in that moment". The user then
-- asked for the payment method to stay visible after the tournament ends,
-- which needs real persistence.
--
-- Deliberately NOT a column on `standings`: standings is a
-- performance/score table, recomputed from scratch on every round advance
-- (calculateRoundScores/updateStandingsAndRanks) — payment method is
-- administrative data, set once at tournament start and never touched by
-- scoring logic again. A separate table keeps that boundary clean and
-- means the standings recompute path can never accidentally clobber it.
--
-- No join needed to read it back: like kills/placementPoints, the app
-- fetches this separately and merges client-side (recompute-on-read
-- pattern already used throughout the standings composables).

CREATE TABLE IF NOT EXISTS tournament_payments (
  tournament_id   INTEGER NOT NULL REFERENCES public.tournaments(tournament_id) ON DELETE CASCADE,
  player_id       INTEGER NOT NULL REFERENCES public.players(player_id) ON DELETE CASCADE,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('pos', 'cash')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, player_id)
);

COMMENT ON TABLE tournament_payments IS 'How each player paid for a tournament (POS/Contanti) — written once at tournament start, never touched by standings recompute logic.';

ALTER TABLE tournament_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read tournament_payments"
  ON tournament_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read tournament_payments"
  ON tournament_payments FOR SELECT TO anon USING (true);

-- Written exclusively via the service-role BFF endpoint (server/api/tournaments/:id/start.post.ts),
-- which bypasses RLS — no write policies needed, matching round_kills/round_results.
GRANT SELECT ON tournament_payments TO anon, authenticated;
