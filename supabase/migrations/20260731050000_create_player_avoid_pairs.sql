-- Migration: Add player_avoid_pairs table for globally-fixed pairing constraints
-- Created: 2026-07-31
--
-- Previously "forbidden pairs" were stored per-tournament in localStorage
-- (pairing-preferences-event-{tournamentId}) via
-- app/composables/event-pairing/pairingPreferences.ts. The user pointed out
-- there's no real use case for a pair being avoided only in one tournament —
-- it should be a fixed, global preference, and shouldn't live in two places
-- (localStorage + DB). This table replaces the localStorage-based forbidden
-- pairs entirely; pairing weights (novelty, rematch, ...) stay per-tournament
-- in localStorage since those genuinely are tournament-specific tuning.
--
-- player_a_id < player_b_id is enforced so each unordered pair has exactly
-- one canonical row — the writing BFF endpoint normalizes ids into this
-- order before insert.

CREATE TABLE IF NOT EXISTS player_avoid_pairs (
  player_a_id  INTEGER NOT NULL REFERENCES public.players(player_id) ON DELETE CASCADE,
  player_b_id  INTEGER NOT NULL REFERENCES public.players(player_id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (player_a_id < player_b_id),
  PRIMARY KEY (player_a_id, player_b_id)
);

COMMENT ON TABLE player_avoid_pairs IS 'Globally-fixed pairs of players that should never be seated at the same table, across every tournament. Written exclusively via the service-role BFF endpoints (server/api/avoid-pairs/*).';

ALTER TABLE player_avoid_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read player_avoid_pairs"
  ON player_avoid_pairs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read player_avoid_pairs"
  ON player_avoid_pairs FOR SELECT TO anon USING (true);

-- Written exclusively via the service-role BFF endpoints (server/api/avoid-pairs/create.post.ts,
-- server/api/avoid-pairs/delete.post.ts), which bypass RLS — no write policies needed.
GRANT SELECT ON player_avoid_pairs TO anon, authenticated;
