-- Migration: fix recalc_player_stats/recalc_deck_stats bigint overload left
-- stale by 20260730000000_rename_event_to_tournament.sql
--
-- Root cause (found via E2E test run, not visible in code/typecheck): both
-- functions have TWO overloads in production — recalc_player_stats(integer)
-- and recalc_player_stats(bigint), same for recalc_deck_stats. Only the
-- integer-typed pair is in a tracked migration
-- (20260528000001_create_stats_tables_and_triggers.sql); the bigint-typed
-- pair was never checked in — untracked dashboard drift, same class of issue
-- as the RLS/grants incidents in ADR-013. round_results.player_id is bigint,
-- so trg_round_results_change()'s `PERFORM recalc_player_stats(NEW.player_id)`
-- always resolves to the bigint overload (Postgres prefers an exact type
-- match over an implicit cast) — meaning the bigint versions are the ones
-- actually live on every round-result write, not the integer ones. The
-- previous migration only rewrote the integer overload (matching the tracked
-- migration), leaving the real, live bigint overload still referencing the
-- pre-rename events_played/event_id columns — breaking every rankings/kills/
-- commander/votes submission with "column events_played does not exist".
--
-- Fix: rewrite the bigint overloads with the renamed columns (keeping their
-- existing DELETE-then-INSERT logic shape, unrelated to this bug), then drop
-- the integer overloads entirely — two overloads with diverging logic for
-- the same name is exactly how this bug happened, and the integer ones are
-- unreachable from the trigger (only reachable via an explicit ::INTEGER
-- cast, e.g. the initial backfill DO block in the original migration, which
-- doesn't run again).

CREATE OR REPLACE FUNCTION public.recalc_player_stats(p_player_id bigint)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM player_stats WHERE player_id = p_player_id;

  INSERT INTO player_stats (
    player_id, tournaments_played, total_matches, total_wins, total_kills, average_score
  )
  SELECT
    p_player_id,
    COALESCE(tournaments.tournaments_count, 0),
    COALESCE(matches.matches_count, 0),
    COALESCE(wins.wins_count, 0),
    COALESCE(kills.kills_count, 0),
    COALESCE(avg_score.avg_score_val, 0)
  FROM (
    SELECT COUNT(DISTINCT s.tournament_id) AS tournaments_count
    FROM standings s
    WHERE s.player_id = p_player_id
  ) AS tournaments,
  (
    SELECT COUNT(*) AS matches_count
    FROM round_results rr
    WHERE rr.player_id = p_player_id
  ) AS matches,
  (
    SELECT COUNT(*) AS wins_count
    FROM round_results rr
    WHERE rr.player_id = p_player_id AND rr.position = 1
  ) AS wins,
  (
    SELECT COALESCE(SUM(rr.number_of_kills), 0) AS kills_count
    FROM round_results rr
    WHERE rr.player_id = p_player_id
  ) AS kills,
  (
    SELECT ROUND(AVG(s.standing_player_score)::numeric, 2) AS avg_score_val
    FROM standings s
    WHERE s.player_id = p_player_id
  ) AS avg_score;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_deck_stats(p_player_id bigint, p_commander_1 text, p_commander_2 text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_commander_1 IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM deck_stats WHERE player_id = p_player_id AND commander_1 = p_commander_1 AND commander_2 IS NOT DISTINCT FROM p_commander_2;

  INSERT INTO deck_stats (
    player_id, commander_1, commander_2,
    tournaments_played, total_matches, total_wins, total_kills, average_score
  )
  SELECT
    p_player_id,
    p_commander_1,
    p_commander_2,
    COALESCE(tournaments.tournaments_count, 0),
    COALESCE(matches.matches_count, 0),
    COALESCE(wins.wins_count, 0),
    COALESCE(kills.kills_count, 0),
    COALESCE(avg_score.avg_score_val, 0)
  FROM (
    SELECT COUNT(DISTINCT p.tournament_id) AS tournaments_count
    FROM round_results rr
    JOIN pairings p ON rr.pairing_id = p.pairing_id
    WHERE rr.player_id = p_player_id
      AND rr.commander_1 = p_commander_1
      AND rr.commander_2 IS NOT DISTINCT FROM p_commander_2
  ) AS tournaments,
  (
    SELECT COUNT(*) AS matches_count
    FROM round_results rr
    WHERE rr.player_id = p_player_id
      AND rr.commander_1 = p_commander_1
      AND rr.commander_2 IS NOT DISTINCT FROM p_commander_2
  ) AS matches,
  (
    SELECT COUNT(*) AS wins_count
    FROM round_results rr
    WHERE rr.player_id = p_player_id
      AND rr.commander_1 = p_commander_1
      AND rr.commander_2 IS NOT DISTINCT FROM p_commander_2
      AND rr.position = 1
  ) AS wins,
  (
    SELECT COALESCE(SUM(rr.number_of_kills), 0) AS kills_count
    FROM round_results rr
    WHERE rr.player_id = p_player_id
      AND rr.commander_1 = p_commander_1
      AND rr.commander_2 IS NOT DISTINCT FROM p_commander_2
  ) AS kills,
  (
    SELECT ROUND(AVG(s.standing_player_score)::numeric, 2) AS avg_score_val
    FROM round_results rr
    JOIN pairings p ON rr.pairing_id = p.pairing_id
    JOIN standings s ON s.tournament_id = p.tournament_id AND s.player_id = rr.player_id
    WHERE rr.player_id = p_player_id
      AND rr.commander_1 = p_commander_1
      AND rr.commander_2 IS NOT DISTINCT FROM p_commander_2
  ) AS avg_score;
END;
$function$;

-- Drop the integer-typed overloads: unreachable from the trigger (which
-- always passes bigint), and keeping two functions with the same name but
-- different logic shapes is the exact footgun that caused this bug.
DROP FUNCTION IF EXISTS public.recalc_player_stats(integer);
DROP FUNCTION IF EXISTS public.recalc_deck_stats(integer, text, text);
