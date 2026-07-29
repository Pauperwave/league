-- Migration: expose each row's own scryfall_id in get_commander_catalog()
-- Created: 2026-07-29
--
-- CommanderModal.vue's "Partner with <specific card>" auto-fill needs to
-- resolve a partner_with commander's exact partner (via
-- partner_with_scryfall_id) to a card name. The cached catalog already has
-- partner_with_scryfall_id per row but not each row's own scryfall_id, so
-- that resolution required 2 extra Supabase round-trips per selection.
-- Adding scryfall_id here lets the client resolve it entirely from the
-- already-cached (30-day) catalog instead.

CREATE OR REPLACE FUNCTION get_commander_catalog()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT card_name, partner_type, keywords, partner_with_scryfall_id,
           scryfall_id, mana_cost, edhrec_rank, image_url
    FROM mtg_commanders
  ) t
$$;

COMMENT ON FUNCTION get_commander_catalog() IS
  'Returns the full mtg_commanders catalog (whitelist + search fields) as one JSON array, avoiding PostgREST''s 1000-row cap. Cached client-side via Pinia Colada + cache-persister (commander-catalog query key). scryfall_id (added 2026-07-29) lets the client resolve a partner_with commander''s exact partner name without an extra DB round-trip.';

GRANT EXECUTE ON FUNCTION get_commander_catalog() TO anon;
