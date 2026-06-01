-- Migration: Simplify app with denormalized stats tables, materialized views, and computed columns
-- This eliminates client-side stat computation by keeping stats in sync via triggers.

-- ============================================================================
-- 1. PLAYER STATS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_stats (
  player_id         INTEGER PRIMARY KEY REFERENCES players(player_id) ON DELETE CASCADE,
  events_played     INTEGER NOT NULL DEFAULT 0,
  total_matches     INTEGER NOT NULL DEFAULT 0,
  total_wins        INTEGER NOT NULL DEFAULT 0,
  total_kills       INTEGER NOT NULL DEFAULT 0,
  average_score     DECIMAL(4,2) NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE player_stats IS 'Denormalized stats per player, auto-updated by triggers on round_results';

-- ============================================================================
-- 2. DECK STATS TABLE (per player + commander combination)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deck_stats (
  id                SERIAL PRIMARY KEY,
  player_id         INTEGER NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  commander_1       TEXT NOT NULL,
  commander_2       TEXT,
  events_played     INTEGER NOT NULL DEFAULT 0,
  total_matches     INTEGER NOT NULL DEFAULT 0,
  total_wins        INTEGER NOT NULL DEFAULT 0,
  total_kills       INTEGER NOT NULL DEFAULT 0,
  average_score     DECIMAL(4,2) NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, commander_1, commander_2)
);

COMMENT ON TABLE deck_stats IS 'Denormalized stats per deck (player+commanders), auto-updated by triggers';

-- ============================================================================
-- 3. COMMANDER STATS MATERIALIZED VIEW (global aggregates)
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS commander_stats AS
SELECT
  commander_1,
  commander_2,
  COUNT(DISTINCT player_id) AS player_count,
  COUNT(*) AS match_count,
  SUM(CASE WHEN position = 1 THEN 1 ELSE 0 END) AS win_count,
  SUM(number_of_kills) AS total_kills,
  ROUND(AVG(number_of_kills), 2) AS average_score
FROM round_results
GROUP BY commander_1, commander_2;

CREATE UNIQUE INDEX idx_commander_stats_pk ON commander_stats (commander_1, COALESCE(commander_2, ''));

COMMENT ON MATERIALIZED VIEW commander_stats IS 'Global aggregate stats per commander across all players. Refresh after round_results changes.';

-- ============================================================================
-- 4. EVENT STATUS GENERATED COLUMN
-- ============================================================================

-- Only add if event_round_number exists; otherwise skip and handle in app
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'event_round_number'
  ) THEN
    ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT
      GENERATED ALWAYS AS (
        CASE
          WHEN event_current_round IS NULL THEN 'not_started'
          WHEN event_current_round >= event_round_number THEN 'completed'
          ELSE 'in_progress'
        END
      ) STORED;
  END IF;
END
$$;

-- ============================================================================
-- 5. TRIGGER FUNCTION: Recalculate player_stats from round_results
-- ============================================================================

CREATE OR REPLACE FUNCTION recalc_player_stats(p_player_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_events  INTEGER;
  v_matches INTEGER;
  v_wins    INTEGER;
  v_kills   INTEGER;
  v_avg     DECIMAL(4,2);
BEGIN
  -- Events played: distinct events this player actually played in (from round_results)
  SELECT COUNT(DISTINCT p.event_id)
  INTO v_events
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

  INSERT INTO player_stats (player_id, events_played, total_matches, total_wins, total_kills, average_score, updated_at)
  VALUES (p_player_id, v_events, v_matches, v_wins, v_kills, ROUND(v_avg, 2), now())
  ON CONFLICT (player_id)
  DO UPDATE SET
    events_played = EXCLUDED.events_played,
    total_matches = EXCLUDED.total_matches,
    total_wins    = EXCLUDED.total_wins,
    total_kills   = EXCLUDED.total_kills,
    average_score = EXCLUDED.average_score,
    updated_at    = now();
END;
$$;

-- ============================================================================
-- 6. TRIGGER FUNCTION: Recalculate deck_stats from round_results
-- ============================================================================

CREATE OR REPLACE FUNCTION recalc_deck_stats(
  p_player_id   INTEGER,
  p_commander_1 TEXT,
  p_commander_2 TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_events  INTEGER;
  v_matches INTEGER;
  v_wins    INTEGER;
  v_kills   INTEGER;
  v_avg     DECIMAL(4,2);
BEGIN
  -- Skip if commander_1 is null (incomplete or invalid record)
  IF p_commander_1 IS NULL THEN
    RETURN;
  END IF;

  -- Events: count distinct pairings -> events for this deck
  SELECT COUNT(DISTINCT pair.event_id)
  INTO v_events
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

  -- Average score: standings for events where this deck was used
  SELECT COALESCE(AVG(s.standing_player_score), 0)
  INTO v_avg
  FROM round_results rr
  JOIN standings s ON s.event_id = (
    SELECT p.event_id FROM pairings p WHERE p.pairing_id = rr.pairing_id
  )
  WHERE rr.player_id = p_player_id
    AND rr.commander_1 = p_commander_1
    AND COALESCE(rr.commander_2, '') = COALESCE(p_commander_2, '');

  INSERT INTO deck_stats (player_id, commander_1, commander_2, events_played, total_matches, total_wins, total_kills, average_score, updated_at)
  VALUES (p_player_id, p_commander_1, p_commander_2, v_events, v_matches, v_wins, v_kills, ROUND(v_avg, 2), now())
  ON CONFLICT (player_id, commander_1, commander_2)
  DO UPDATE SET
    events_played = EXCLUDED.events_played,
    total_matches = EXCLUDED.total_matches,
    total_wins    = EXCLUDED.total_wins,
    total_kills   = EXCLUDED.total_kills,
    average_score = EXCLUDED.average_score,
    updated_at    = now();
END;
$$;

-- ============================================================================
-- 7. TRIGGER: Auto-recalc stats on round_results changes
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_round_results_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Recalc player stats
  IF TG_OP = 'DELETE' THEN
    PERFORM recalc_player_stats(OLD.player_id);
    PERFORM recalc_deck_stats(OLD.player_id, OLD.commander_1, OLD.commander_2);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM recalc_player_stats(NEW.player_id);
    PERFORM recalc_deck_stats(NEW.player_id, NEW.commander_1, NEW.commander_2);
    -- If commander changed, also recalc old deck stats
    IF OLD.commander_1 IS DISTINCT FROM NEW.commander_1 OR OLD.commander_2 IS DISTINCT FROM NEW.commander_2 THEN
      PERFORM recalc_deck_stats(OLD.player_id, OLD.commander_1, OLD.commander_2);
    END IF;
    RETURN NEW;
  ELSE -- INSERT
    PERFORM recalc_player_stats(NEW.player_id);
    PERFORM recalc_deck_stats(NEW.player_id, NEW.commander_1, NEW.commander_2);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS round_results_change ON round_results;
CREATE TRIGGER round_results_change
  AFTER INSERT OR UPDATE OR DELETE ON round_results
  FOR EACH ROW
  EXECUTE FUNCTION trg_round_results_change();

-- ============================================================================
-- 8. FUNCTION: Refresh commander_stats materialized view
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_commander_stats()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY commander_stats;
END;
$$;

-- NOTE: Auto-refresh is disabled to avoid performance issues during bulk operations.
-- Refresh the materialized view manually after batch imports, or schedule via pg_cron.
-- Example: SELECT refresh_commander_stats();

-- If you need real-time updates, uncomment the trigger below (not recommended for high-volume writes):
-- CREATE OR REPLACE FUNCTION trg_refresh_commander_stats()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   PERFORM refresh_commander_stats();
--   IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
-- END;
-- $$;
--
-- DROP TRIGGER IF EXISTS refresh_commander_stats ON round_results;
-- CREATE TRIGGER refresh_commander_stats
--   AFTER INSERT OR UPDATE OR DELETE ON round_results
--   FOR EACH STATEMENT
--   EXECUTE FUNCTION trg_refresh_commander_stats();

-- ============================================================================
-- 9. INITIAL DATA POPULATION
-- ============================================================================

-- Populate player_stats for all existing players
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT player_id FROM players LOOP
    PERFORM recalc_player_stats(r.player_id::INTEGER);
  END LOOP;
END;
$$;

-- Populate deck_stats for all existing (player, commander) combinations
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT player_id, commander_1, commander_2
    FROM round_results
    WHERE commander_1 IS NOT NULL
  LOOP
    PERFORM recalc_deck_stats(r.player_id::INTEGER, r.commander_1, r.commander_2);
  END LOOP;
END;
$$;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW commander_stats;

-- ============================================================================
-- 10. RLS POLICIES (enable on new tables)
-- ============================================================================

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_stats ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read stats (adjust as needed)
CREATE POLICY "Allow authenticated read player_stats"
  ON player_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read deck_stats"
  ON deck_stats FOR SELECT
  TO authenticated
  USING (true);

-- Only the service role (or admin) can write — triggers bypass RLS anyway
CREATE POLICY "Deny direct write player_stats"
  ON player_stats FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny direct write deck_stats"
  ON deck_stats FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- 11. REST API ACCESS
-- ============================================================================

-- Grant anon and authenticated roles access via the Data API (PostgREST)
GRANT SELECT ON player_stats TO anon, authenticated;
GRANT SELECT ON deck_stats TO anon, authenticated;
GRANT SELECT ON commander_stats TO anon, authenticated;

-- Add tables to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE player_stats, deck_stats;

-- ============================================================================
-- 12. RLS POLICIES FOR EXISTING APP TABLES
-- ============================================================================

-- Many app tables have RLS enabled but no policies, causing 406 errors

CREATE POLICY "Allow authenticated read events"
  ON events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read events"
  ON events FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated read pairings"
  ON pairings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read pairings"
  ON pairings FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated read players"
  ON players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read players"
  ON players FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated read round_results"
  ON round_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read round_results"
  ON round_results FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated read rulesets"
  ON rulesets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read rulesets"
  ON rulesets FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated read standings"
  ON standings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read standings"
  ON standings FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated read waitroom"
  ON waitroom FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read waitroom"
  ON waitroom FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated read leagues"
  ON leagues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon read leagues"
  ON leagues FOR SELECT TO anon USING (true);
