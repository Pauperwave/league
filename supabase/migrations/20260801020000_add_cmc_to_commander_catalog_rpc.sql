-- Migration: expose cmc in get_commander_catalog()
-- Created: 2026-08-01
--
-- The /commanders table sorts by mana cost using the raw mana_cost string
-- ("{2}{U}{U}"), which sorts alphabetically instead of by actual cost.
-- mana_cost already isn't a valid sort key; the numeric cmc column has been
-- on mtg_commanders since it was first synced from Scryfall, just never
-- exposed by this RPC. Adding it lets the column sort by the real value.

CREATE OR REPLACE FUNCTION get_commander_catalog()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT card_name, partner_type, keywords, partner_with_scryfall_id,
           scryfall_id, mana_cost, cmc, edhrec_rank, image_url, art_crop_url
    FROM mtg_commanders
  ) t
$$;

COMMENT ON FUNCTION get_commander_catalog() IS
  'Returns the full mtg_commanders catalog (whitelist + search fields) as one JSON array, avoiding PostgREST''s 1000-row cap. Cached client-side via Pinia Colada + cache-persister (commander-catalog query key). scryfall_id (2026-07-29) resolves partner_with partners client-side; art_crop_url (2026-07-31) lets CommanderVoteCard show cropped artwork without an extra DB round-trip; cmc (2026-08-01) lets the /commanders table sort mana cost numerically instead of alphabetically on the raw string.';

GRANT EXECUTE ON FUNCTION get_commander_catalog() TO anon;
