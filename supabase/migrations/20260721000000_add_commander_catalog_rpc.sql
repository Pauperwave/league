-- Migration: RPC to fetch the full commander catalog in one request
-- Created: 2026-07-21
--
-- The client needs a lightweight snapshot of every commander (for whitelist
-- classification + autocomplete search) cached via Pinia Colada. A plain
-- `select *` on mtg_commanders (2986 rows) gets silently truncated to 1000
-- rows by PostgREST's default row cap — this happened in production and
-- broke Background-commander detection for ~2000 cards. json_agg collapses
-- the whole result into a single JSON value, so PostgREST sees exactly one
-- row in the response and the per-row cap never applies.

CREATE OR REPLACE FUNCTION get_commander_catalog()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT card_name, partner_type, keywords, partner_with_scryfall_id,
           mana_cost, edhrec_rank, image_url
    FROM mtg_commanders
  ) t
$$;

COMMENT ON FUNCTION get_commander_catalog() IS
  'Returns the full mtg_commanders catalog (whitelist + search fields) as one JSON array, avoiding PostgREST''s 1000-row cap. Cached client-side via Pinia Colada + cache-persister (commander-catalog query key).';

GRANT EXECUTE ON FUNCTION get_commander_catalog() TO anon;
