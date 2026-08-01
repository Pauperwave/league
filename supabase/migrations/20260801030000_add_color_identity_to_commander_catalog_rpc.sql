-- Migration: expose color_identity in get_commander_catalog()
-- Created: 2026-08-01
--
-- The /commanders table's "Costo mana" column should sort by color group
-- (W, U, B, R, G, multicolor, colorless) before cmc, the conventional MTG
-- collection sort — same grouping already used for the /decks color sort
-- (colorOrder in app/pages/decks/index.vue). That page resolves color from
-- the per-commander Scryfall fetch (useCommanderCards' colorIdentity); the
-- catalog RPC never exposed it, so /commanders had no way to group by color
-- without an extra per-row query.

CREATE OR REPLACE FUNCTION get_commander_catalog()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT card_name, partner_type, keywords, partner_with_scryfall_id,
           scryfall_id, mana_cost, cmc, color_identity, edhrec_rank, image_url, art_crop_url
    FROM mtg_commanders
  ) t
$$;

COMMENT ON FUNCTION get_commander_catalog() IS
  'Returns the full mtg_commanders catalog (whitelist + search fields) as one JSON array, avoiding PostgREST''s 1000-row cap. Cached client-side via Pinia Colada + cache-persister (commander-catalog query key). scryfall_id (2026-07-29) resolves partner_with partners client-side; art_crop_url (2026-07-31) lets CommanderVoteCard show cropped artwork without an extra DB round-trip; cmc (2026-08-01) lets the /commanders table sort mana cost numerically instead of alphabetically on the raw string; color_identity (2026-08-01) lets it group by color (WUBRG, multicolor, colorless) before cmc, the conventional MTG sort.';

GRANT EXECUTE ON FUNCTION get_commander_catalog() TO anon;
