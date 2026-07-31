-- supabase\migrations\20260731020000_add_released_at_to_mtg_commanders.sql
-- Scryfall release date of the synced printing. Lets the sync-commanders
-- admin endpoint query Scryfall with `date>=<max known release>` instead of
-- paginating (or heuristically early-stopping through) the entire ~3600-card
-- commander-eligible result set on every run.
alter table mtg_commanders
  add column if not exists released_at date;

comment on column mtg_commanders.released_at is
  'Scryfall release date of the synced printing. NULL until the sync-commanders admin endpoint backfills it (one-time, on first run after this migration).';
