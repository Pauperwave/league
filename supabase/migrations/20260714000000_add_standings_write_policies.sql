-- supabase\migrations\20260714000000_add_standings_write_policies.sql
-- Ensures the anon and authenticated roles can WRITE to standings.
--
-- Context: the app runs as `anon` (single site-password gate, no Supabase user
-- auth). Round scoring (`updateStandingsAndRanks` in app/stores/events.ts)
-- UPDATEs standings after every round; with RLS enabled and no UPDATE policy
-- for anon, PostgREST silently filters the update (0 rows affected, NO error)
-- and every player's score stays 0 for the whole event. The repo's migrations
-- only ever created SELECT policies for standings
-- (20260528000001_create_stats_tables_and_triggers.sql) — INSERT evidently
-- works on the live DB via a dashboard-created policy, but UPDATE does not.
--
-- Idempotent: drops and recreates only the policies named here. FOR ALL covers
-- INSERT/UPDATE/DELETE (turnBackRound also deletes standings rows) and is
-- permissive alongside any existing dashboard policies.

DROP POLICY IF EXISTS "Allow anon write standings" ON standings;
CREATE POLICY "Allow anon write standings"
  ON standings FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated write standings" ON standings;
CREATE POLICY "Allow authenticated write standings"
  ON standings FOR ALL TO authenticated USING (true) WITH CHECK (true);
