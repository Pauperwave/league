-- Migration: rename the "event" domain concept to "tournament" (BACKLOG #8, phase 2/3 combined)
--
-- Context: "Event" was always the wrong word for this domain concept — a
-- tournament. Phase 1 (2026-07-30, ADR-044) renamed only the Italian UI text.
-- This migration renames the table/columns/constraints/policies themselves;
-- the application-layer rename (types, store, composables, components,
-- routes, server endpoints, i18n keys) ships in the same session, after this
-- migration is applied and shared/utils/types/database.ts is regenerated.
--
-- Column renames cascade automatically through PostgreSQL's internal
-- attnum-based references (FK definitions, indexes, the generated `status`
-- column on the renamed table, and RLS policy USING/WITH CHECK clauses) — no
-- explicit action needed for those. Only *named* constraints/policies need
-- an explicit RENAME so `database.ts`'s generated `Relationships` stay
-- readable instead of carrying stale "events_..." names forever.

-- ============================================================================
-- 1. Table + columns: events -> tournaments
-- ============================================================================

ALTER TABLE public.events RENAME TO tournaments;

ALTER TABLE public.tournaments RENAME COLUMN event_id TO tournament_id;
ALTER TABLE public.tournaments RENAME COLUMN event_name TO tournament_name;
ALTER TABLE public.tournaments RENAME COLUMN event_datetime TO tournament_datetime;
ALTER TABLE public.tournaments RENAME COLUMN event_current_round TO tournament_current_round;
ALTER TABLE public.tournaments RENAME COLUMN event_round_number TO tournament_round_number;
ALTER TABLE public.tournaments RENAME COLUMN event_playing TO tournament_playing;
ALTER TABLE public.tournaments RENAME COLUMN event_registration_open TO tournament_registration_open;
ALTER TABLE public.tournaments RENAME COLUMN event_round_duration TO tournament_round_duration;

-- FK to leagues (name confirmed via 20260719030000_restrict_league_event_cascade_deletes.sql)
ALTER TABLE public.tournaments RENAME CONSTRAINT events_league_id_fkey TO tournaments_league_id_fkey;

-- Primary key constraint name was never captured in a tracked migration (table
-- predates migration tracking) — rename only if it still has the Postgres
-- default name, no-op otherwise rather than failing the whole migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_pkey') THEN
    ALTER TABLE public.tournaments RENAME CONSTRAINT events_pkey TO tournaments_pkey;
  END IF;
END
$$;

-- ============================================================================
-- 2. Referencing tables: pairings, standings, waitroom
-- ============================================================================

ALTER TABLE public.pairings RENAME COLUMN event_id TO tournament_id;
ALTER TABLE public.pairings RENAME CONSTRAINT pairings_event_id_fkey TO pairings_tournament_id_fkey;

ALTER TABLE public.standings RENAME COLUMN event_id TO tournament_id;
ALTER TABLE public.standings RENAME CONSTRAINT standings_event_id_fkey TO standings_tournament_id_fkey;
ALTER TABLE public.standings RENAME CONSTRAINT standings_event_id_player_id_key TO standings_tournament_id_player_id_key;

ALTER TABLE public.waitroom RENAME COLUMN event_id TO tournament_id;
ALTER TABLE public.waitroom RENAME CONSTRAINT waitroom_event_id_fkey TO waitroom_tournament_id_fkey;

-- ============================================================================
-- 3. Denormalized stats columns + leagues.valid_events
-- ============================================================================

ALTER TABLE public.player_stats RENAME COLUMN events_played TO tournaments_played;
ALTER TABLE public.deck_stats RENAME COLUMN events_played TO tournaments_played;
ALTER TABLE public.leagues RENAME COLUMN valid_events TO valid_tournaments;

-- ============================================================================
-- 4. RLS policy names on the renamed table (cosmetic, but avoids permanently
--    stale "events" policy names on a table now called tournaments)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tournaments' AND policyname = 'Allow authenticated read events'
  ) THEN
    ALTER POLICY "Allow authenticated read events" ON public.tournaments RENAME TO "Allow authenticated read tournaments";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tournaments' AND policyname = 'Allow anon read events'
  ) THEN
    ALTER POLICY "Allow anon read events" ON public.tournaments RENAME TO "Allow anon read tournaments";
  END IF;
END
$$;

-- ============================================================================
-- 5. Trigger functions: recalc_player_stats / recalc_deck_stats
--    (rewritten to reference the renamed columns; logic unchanged)
-- ============================================================================

CREATE OR REPLACE FUNCTION recalc_player_stats(p_player_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_tournaments INTEGER;
  v_matches     INTEGER;
  v_wins        INTEGER;
  v_kills       INTEGER;
  v_avg         DECIMAL(4,2);
BEGIN
  -- Tournaments played: distinct tournaments this player actually played in (from round_results)
  SELECT COUNT(DISTINCT p.tournament_id)
  INTO v_tournaments
  FROM round_results r
  JOIN pairings p ON r.pairing_id = p.pairing_id
  WHERE r.player_id = p_player_id;

  -- Match stats from round_results
  SELECT
    COUNT(*),
    COALESCE(SUM(CASE WHEN position = 1 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(number_of_kills), 0)
  INTO v_matches, v_wins, v_kills
  FROM round_results
  WHERE player_id = p_player_id;

  -- Average score from standings
  SELECT COALESCE(AVG(standing_player_score), 0)
  INTO v_avg
  FROM standings
  WHERE player_id = p_player_id;

  INSERT INTO player_stats (player_id, tournaments_played, total_matches, total_wins, total_kills, average_score, updated_at)
  VALUES (p_player_id, v_tournaments, v_matches, v_wins, v_kills, ROUND(v_avg, 2), now())
  ON CONFLICT (player_id)
  DO UPDATE SET
    tournaments_played = EXCLUDED.tournaments_played,
    total_matches       = EXCLUDED.total_matches,
    total_wins           = EXCLUDED.total_wins,
    total_kills           = EXCLUDED.total_kills,
    average_score          = EXCLUDED.average_score,
    updated_at              = now();
END;
$$;

CREATE OR REPLACE FUNCTION recalc_deck_stats(
  p_player_id   INTEGER,
  p_commander_1 TEXT,
  p_commander_2 TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_tournaments INTEGER;
  v_matches     INTEGER;
  v_wins        INTEGER;
  v_kills       INTEGER;
  v_avg         DECIMAL(4,2);
BEGIN
  -- Skip if commander_1 is null (incomplete or invalid record)
  IF p_commander_1 IS NULL THEN
    RETURN;
  END IF;

  -- Tournaments: count distinct pairings -> tournaments for this deck
  SELECT COUNT(DISTINCT pair.tournament_id)
  INTO v_tournaments
  FROM round_results rr
  JOIN pairings pair ON rr.pairing_id = pair.pairing_id
  WHERE rr.player_id = p_player_id
    AND rr.commander_1 = p_commander_1
    AND COALESCE(rr.commander_2, '') = COALESCE(p_commander_2, '');

  -- Match stats
  SELECT
    COUNT(*),
    COALESCE(SUM(CASE WHEN position = 1 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(number_of_kills), 0)
  INTO v_matches, v_wins, v_kills
  FROM round_results
  WHERE player_id = p_player_id
    AND commander_1 = p_commander_1
    AND COALESCE(commander_2, '') = COALESCE(p_commander_2, '');

  -- Average score: standings for tournaments where this deck was used
  SELECT COALESCE(AVG(s.standing_player_score), 0)
  INTO v_avg
  FROM round_results rr
  JOIN standings s ON s.tournament_id = (
    SELECT p.tournament_id FROM pairings p WHERE p.pairing_id = rr.pairing_id
  )
  WHERE rr.player_id = p_player_id
    AND rr.commander_1 = p_commander_1
    AND COALESCE(rr.commander_2, '') = COALESCE(p_commander_2, '');

  INSERT INTO deck_stats (player_id, commander_1, commander_2, tournaments_played, total_matches, total_wins, total_kills, average_score, updated_at)
  VALUES (p_player_id, p_commander_1, p_commander_2, v_tournaments, v_matches, v_wins, v_kills, ROUND(v_avg, 2), now())
  ON CONFLICT (player_id, commander_1, commander_2)
  DO UPDATE SET
    tournaments_played = EXCLUDED.tournaments_played,
    total_matches       = EXCLUDED.total_matches,
    total_wins           = EXCLUDED.total_wins,
    total_kills           = EXCLUDED.total_kills,
    average_score          = EXCLUDED.average_score,
    updated_at              = now();
END;
$$;
