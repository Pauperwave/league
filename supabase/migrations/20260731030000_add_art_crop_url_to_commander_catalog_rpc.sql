-- Migration: expose art_crop_url in get_commander_catalog()
-- Created: 2026-07-31
--
-- CommanderVoteCard.vue (voting modal) needs the cropped artwork, not the
-- full card image (image_url) already exposed here — showing the full card
-- (borders, text box) looked wrong in a small card body. Adding
-- art_crop_url lets it resolve entirely from the already-cached (30-day)
-- catalog instead of a dedicated per-name Supabase query.

CREATE OR REPLACE FUNCTION get_commander_catalog()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT card_name, partner_type, keywords, partner_with_scryfall_id,
           scryfall_id, mana_cost, edhrec_rank, image_url, art_crop_url
    FROM mtg_commanders
  ) t
$$;

COMMENT ON FUNCTION get_commander_catalog() IS
  'Returns the full mtg_commanders catalog (whitelist + search fields) as one JSON array, avoiding PostgREST''s 1000-row cap. Cached client-side via Pinia Colada + cache-persister (commander-catalog query key). scryfall_id (2026-07-29) resolves partner_with partners client-side; art_crop_url (2026-07-31) lets CommanderVoteCard show cropped artwork without an extra DB round-trip.';

GRANT EXECUTE ON FUNCTION get_commander_catalog() TO anon;
