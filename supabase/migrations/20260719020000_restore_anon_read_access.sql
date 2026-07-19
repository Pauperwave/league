-- Migration: Restore anon SELECT (read-only) access
-- Created: 2026-07-19
--
-- Emergency fix: an external "security cleanup" dropped every anon_all_*
-- policy (FOR ALL, true/true) on all 12 app tables. Those blanket policies
-- were doing double duty — they were also the ONLY anon read access on
-- several tables (player_stats/deck_stats only ever had an "authenticated"
-- SELECT policy in tracked migrations, a role this app never actually uses
-- since there's no Supabase Auth, just a shared site-password gate — see
-- BACKLOG #7). Dropping them blocked every anonymous read app-wide, not
-- just writes: client-side reads in this app go directly to Supabase with
-- the anon key (BACKLOG #7's documented architecture, unchanged by the
-- BFF write migration), so this broke the live site's reads entirely.
--
-- This migration restores ONLY read access (FOR SELECT), matching intended
-- architecture. It deliberately does NOT restore any anon write policy —
-- removing anon write access was correct: every client write now goes
-- through a server/api/* BFF endpoint (ADR-013/015), so anon should have
-- zero direct write access. Writes will still fail until SUPABASE_SERVICE_KEY
-- is configured and the BFF endpoints switch to serverSupabaseServiceRole —
-- that is expected, not a bug this migration needs to fix.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'commander_decks', 'deck_stats', 'events', 'leagues', 'mtg_commanders',
    'pairings', 'player_stats', 'players', 'round_results', 'rulesets',
    'standings', 'waitroom'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'anon_read_only'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "anon_read_only" ON public.%I FOR SELECT TO anon USING (true)',
        t
      );
    END IF;

    -- Idempotent — PostgreSQL ignores a duplicate GRANT.
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END
$$;
