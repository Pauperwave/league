# Database Documentation

## Row Level Security (RLS) Policies

All tables in the `public` schema have **RLS enabled**. Every table that needs REST API access MUST have SELECT policies for both `anon` and `authenticated` roles.

### Policy Pattern

When creating a new table, always run:

```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read new_table"
  ON new_table FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon read new_table"
  ON new_table FOR SELECT
  TO anon
  USING (true);
```

### App Data Tables

| Table | SELECT (anon) | SELECT (auth) | Write (auth) | Notes |
|-------|--------------|---------------|--------------|-------|
| `leagues` | ✅ | ✅ | ✅ | Public data |
| `events` | ✅ | ✅ | ✅ | Public data |
| `pairings` | ✅ | ✅ | ✅ | Public data |
| `players` | ✅ | ✅ | ✅ | Public data |
| `round_results` | ✅ | ✅ | ✅ | Public data |
| `rulesets` | ✅ | ✅ | ✅ | Public data |
| `standings` | ✅ | ✅ | ✅ | Public data |
| `waitroom` | ✅ | ✅ | ✅ | Public data |
| `commander_decks` | ✅ | ✅ | ✅ | Public data |
| `mtg_commanders` | ✅ | ✅ | ❌ Denied | Read-only lookup table (synced from Scryfall) |

### Denormalized Stats Tables

| Table | SELECT (anon) | SELECT (auth) | Write | Notes |
|-------|--------------|---------------|-------|-------|
| `player_stats` | ✅ | ✅ | ❌ Denied | Auto-updated by triggers |
| `deck_stats` | ✅ | ✅ | ❌ Denied | Auto-updated by triggers |

### Materialized Views

| View | SELECT (anon) | SELECT (auth) | Notes |
|------|--------------|---------------|-------|
| `commander_stats` | ✅ | ✅ | Refreshed by trigger on round_results changes |

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

1. **RLS enabled + no matching policy** → Add SELECT policies for `anon`/`authenticated`
2. **PostgREST schema cache stale** → Send `NOTIFY pgrst, 'reload schema'` or restart the Supabase project from the dashboard

Always check `pg_policies` after enabling RLS:

```sql
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'your_table_name'
ORDER BY policyname;
```

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

All app tables must have `GRANT SELECT` for both `anon` and `authenticated` roles:

```sql
GRANT SELECT ON player_stats TO anon, authenticated;
GRANT SELECT ON deck_stats TO anon, authenticated;
GRANT SELECT ON commander_stats TO anon, authenticated;
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
