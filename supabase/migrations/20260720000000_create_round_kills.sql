-- Migration: Add round_kills table to persist individual killer->victim events
-- Created: 2026-07-20
--
-- round_results.number_of_kills has always been an aggregate count per
-- player, with no record of *who* killed *whom* — the kill-tracking modal's
-- Vue Flow canvas already models this relationally (app/stores/kills.ts,
-- Kill { killerId, victimId }), but that data was discarded on save, only
-- the per-player count survived. This table captures the actual kill
-- events so they persist and can be queried later (e.g. nemesis pairs,
-- per-player kill breakdowns), while round_results.number_of_kills stays
-- in sync as a derived count for the existing stats triggers.
--
-- FK on pairing_id is ON DELETE RESTRICT, matching round_results'
-- convention as of 20260719030000 — turn-back-round.post.ts must delete a
-- round's round_kills rows explicitly (alongside round_results) before
-- deleting its pairings, same defense-in-depth reasoning as that migration.

CREATE TABLE IF NOT EXISTS round_kills (
  id          SERIAL PRIMARY KEY,
  pairing_id  INTEGER NOT NULL REFERENCES public.pairings(pairing_id) ON DELETE RESTRICT,
  killer_id   INTEGER NOT NULL REFERENCES public.players(player_id),
  victim_id   INTEGER NOT NULL REFERENCES public.players(player_id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pairing_id, killer_id, victim_id)
);

COMMENT ON TABLE round_kills IS 'Individual killer->victim events per pairing. round_results.number_of_kills is a derived count kept in sync from this table by the kills BFF endpoint.';

ALTER TABLE round_kills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read round_kills"
  ON round_kills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read round_kills"
  ON round_kills FOR SELECT TO anon USING (true);

-- Written exclusively via the service-role BFF endpoint (server/api/pairings/:id/kills.post.ts),
-- which bypasses RLS — no write policies needed, matching round_results.
GRANT SELECT ON round_kills TO anon, authenticated;
