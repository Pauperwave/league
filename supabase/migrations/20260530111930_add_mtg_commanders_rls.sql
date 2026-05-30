-- Migration: Add RLS policies for mtg_commanders table
-- Created: 2026-05-30
-- Security fix: mtg_commanders was created without RLS policies

-- Enable RLS (idempotent — safe to re-run)
ALTER TABLE mtg_commanders ENABLE ROW LEVEL SECURITY;

-- Allow all users (anon + authenticated) to read commander data
-- (PostgreSQL CREATE POLICY does not support IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Public read access' AND tablename = 'mtg_commanders'
  ) THEN
    CREATE POLICY "Public read access"
      ON mtg_commanders FOR SELECT
      TO public
      USING (true);
  END IF;
END
$$;

-- Only service role / admin can write — app should never modify this table directly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Deny direct write mtg_commanders' AND tablename = 'mtg_commanders'
  ) THEN
    CREATE POLICY "Deny direct write mtg_commanders"
      ON mtg_commanders FOR ALL
      TO authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

-- Grant Data API access (idempotent — PostgreSQL ignores duplicate GRANTs)
GRANT SELECT ON mtg_commanders TO anon, authenticated;

-- Add to realtime publication (safe to re-run — ignores if already member)
ALTER PUBLICATION supabase_realtime ADD TABLE mtg_commanders;
