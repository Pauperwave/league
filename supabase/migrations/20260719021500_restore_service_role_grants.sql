-- Migration: Restore service_role table/sequence/function grants
-- Created: 2026-07-19
--
-- Part 2 of the RLS-drift fix (see 20260719020000_restore_anon_read_access.sql).
-- service_role had ZERO grants on the public schema's tables — confirmed via
-- information_schema.role_table_grants returning no rows for 'service_role'
-- on any app table, while anon/authenticated/postgres all had full grants
-- (the normal Supabase default, where RLS — not the grant — is the actual
-- gate for those roles). This blocked the BACKLOG #7 service-role flip:
-- server/api/* endpoints switched to serverSupabaseServiceRole get
-- "permission denied for table X", a base ACL error that happens before RLS
-- is even evaluated — restoring RLS policies alone (the first migration)
-- can't fix this, since service_role bypasses RLS entirely via its BYPASSRLS
-- role attribute and was never blocked by policies in the first place.
--
-- This restores the standard Supabase baseline: service_role has full
-- privileges on the public schema (tables, sequences, functions), plus
-- default privileges so future tables/objects aren't silently excluded.
-- service_role is never exposed to the browser — only used server-side via
-- the secret key (NUXT_SUPABASE_SECRET_KEY/SUPABASE_SECRET_KEY) — so this
-- is not a security-relevant grant, just restoring intended baseline access.

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
