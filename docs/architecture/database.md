# Database Documentation

## Row Level Security (RLS) Policies

All tables in the `public` schema have **RLS enabled**. This app has no Supabase Auth (`authenticated` role is never actually used — auth is a single shared site-password gate, see ADR-014 in `docs/PROGRESS.md`), so the only two roles that matter are `anon` (client-side reads) and `service_role` (server-side writes via the BFF, ADR-013). Every table needs a `SELECT` policy for `anon`; **no table should have any write policy for `anon`** — writes go exclusively through `server/api/*` endpoints using `serverSupabaseServiceRole`, which bypasses RLS entirely.

### Policy Pattern

When creating a new table, always run:

```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_only"
  ON new_table FOR SELECT
  TO anon
  USING (true);

-- Never add an anon write policy. Writes go through a server/api/* BFF
-- endpoint using serverSupabaseServiceRole, which bypasses RLS.
```

### App Data Tables

All 12 app tables follow the same shape: `anon` gets `SELECT`-only, `service_role` (server-side only, never exposed to the browser) has full read/write access via table GRANTs, and every write path is a `server/api/*` endpoint (ADR-013/015).

| Table | SELECT (anon) | Write | Notes |
|-------|--------------|-------|-------|
| `leagues` | ✅ | server-side only | BFF: `/api/leagues/*` |
| `events` | ✅ | server-side only | BFF: `/api/events/*` |
| `pairings` | ✅ | server-side only | BFF: `/api/pairings/*`, `/api/events/*/advance-round` etc. |
| `players` | ✅ | server-side only | BFF: `/api/players/*` |
| `round_results` | ✅ | server-side only | BFF: `server/utils/roundResults.ts` (shared scaffolding) |
| `rulesets` | ✅ | server-side only | BFF: `/api/rulesets/*` |
| `standings` | ✅ | server-side only | BFF: `/api/events/*/advance-round` etc. |
| `waitroom` | ✅ | server-side only | BFF: `/api/events/*/register-player`/`unregister-player` |
| `commander_decks` | ✅ | server-side only | BFF: `/api/decks/*` |
| `mtg_commanders` | ✅ | ❌ Denied (server included) | Read-only lookup table (synced from Scryfall) |

### Denormalized Stats Tables

| Table | SELECT (anon) | Write | Notes |
|-------|--------------|-------|-------|
| `player_stats` | ✅ | ❌ Denied (server included) | Auto-updated by triggers only |
| `deck_stats` | ✅ | ❌ Denied (server included) | Auto-updated by triggers only |

### Materialized Views

| View | SELECT (anon) | Notes |
|------|--------------|-------|
| `commander_stats` | ✅ | Refreshed by trigger on round_results changes |

### RLS-Enabled System Tables (No Policies Needed)

These tables have RLS enabled but are managed by Supabase Auth/Storage internally:

- `users` (Supabase Auth)
- `sessions` (Supabase Auth)
- `refresh_tokens` (Supabase Auth)
- `mfa_factors` (Supabase Auth)
- `mfa_challenges` (Supabase Auth)
- `mfa_amr_claims` (Supabase Auth)
- `one_time_tokens` (Supabase Auth)
- `saml_providers` (Supabase Auth)
- `saml_relay_states` (Supabase Auth)
- `sso_providers` (Supabase Auth)
- `sso_domains` (Supabase Auth)
- `identities` (Supabase Auth)
- `instances` (Supabase Auth)
- `audit_log_entries` (Supabase Auth)
- `buckets` (Supabase Storage)
- `objects` (Supabase Storage)
- `s3_multipart_uploads` (Supabase Storage)
- `s3_multipart_uploads_parts` (Supabase Storage)
- `vector_indexes` (Supabase AI)
- `buckets_analytics` (Supabase AI)
- `buckets_vectors` (Supabase AI)
- `flow_state` (Supabase Auth)

### Key Insight

A **406 Not Acceptable** error from the Supabase REST API usually means one of:

1. **RLS enabled + no matching policy** → Add a `SELECT` policy for `anon`
2. **PostgREST schema cache stale** → Send `NOTIFY pgrst, 'reload schema'` or restart the Supabase project from the dashboard

A **"permission denied for table X"** error (distinct from an RLS violation, which reads "new row violates row-level security policy") means the connecting role has no table-level GRANT at all — this check happens *before* RLS is even evaluated, so no policy change can fix it. `service_role` in particular is not exempt from needing explicit GRANTs just because it bypasses RLS (`BYPASSRLS` is a separate role attribute from table ACLs) — see the 2026-07-19 incident below.

Always check `pg_policies` after enabling RLS:

```sql
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'your_table_name'
ORDER BY policyname;
```

And check actual table grants (separately from RLS policies) if writes/reads fail with a permission error rather than an RLS violation:

```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'your_table_name'
ORDER BY grantee, privilege_type;
```

**2026-07-19 incident:** dashboard-side RLS cleanup dropped every `anon_all_*` policy across all 12 app tables (untracked in `supabase/migrations/`) — correctly closing anon write access, but it was also the only anon *read* access on `player_stats`/`deck_stats` (their tracked migration only grants `SELECT` to `authenticated`, a role this app never uses). Separately, `service_role` turned out to have zero table grants at all (confirmed via the query above returning no `service_role` rows, vs. full grants for `anon`/`authenticated`/`postgres`) — blocking the BACKLOG #7 service-role flip with "permission denied," not an RLS error. Both fixed via `supabase/migrations/20260719020000_restore_anon_read_access.sql` (anon `SELECT`-only) and `20260719021500_restore_service_role_grants.sql` (`GRANT ALL` + `ALTER DEFAULT PRIVILEGES` for `service_role`). **Lesson: RLS policies and table grants can both drift outside version control via dashboard edits** — the tracked migrations in `supabase/migrations/` are not guaranteed to reflect the live policy/grant state; worth an occasional audit against both queries above.

## Denormalized Stats Architecture

### Tables

| Table | Primary Key | Purpose |
|-------|------------|---------|
| `player_stats` | `player_id` (FK to players) | Events played, total matches, wins, kills, average score |
| `deck_stats` | `(player_id, commander_1, commander_2)` | Same stats per player+commander combination |
| `commander_stats` | `(commander_1, commander_2)` | Global aggregates across all players |

### Triggers

| Trigger | Table | Action |
|---------|-------|--------|
| `round_results_change` | `round_results` | Recalculates player_stats and deck_stats on INSERT/UPDATE/DELETE |
| `refresh_commander_stats` | `round_results` | Refreshes `commander_stats` materialized view |

### Trigger Functions

| Function | Purpose |
|----------|---------|
| `recalc_player_stats(player_id)` | Recomputes all player stats from standings + round_results |
| `recalc_deck_stats(player_id, commander_1, commander_2)` | Recomputes deck stats from round_results |
| `refresh_commander_stats()` | Calls `REFRESH MATERIALIZED VIEW CONCURRENTLY commander_stats` |

## REST API Access

All app tables must have `GRANT SELECT` for `anon` (this app doesn't use `authenticated`, see above) and full grants for `service_role` (server-side writes only):

```sql
GRANT SELECT ON player_stats TO anon;
GRANT SELECT ON deck_stats TO anon;
GRANT SELECT ON commander_stats TO anon;

GRANT ALL ON player_stats TO service_role;
GRANT ALL ON deck_stats TO service_role;
```

Add new tables to the `supabase_realtime` publication for live updates:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE new_table;
```

## Migrations

All database changes should be tracked in `supabase/migrations/`:

- Use timestamp prefix: `YYYYMMDDHHMMSS_descriptive_name.sql`
- Include `CREATE TABLE IF NOT EXISTS` to make migrations idempotent
- Add RLS policies + GRANT statements in every migration
- Include initial data population for backfills
- Run `supabase db advisors` after making changes (if using Supabase CLI)
