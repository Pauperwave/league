-- Migration: Replace ON DELETE CASCADE with RESTRICT for leagues/events/pairings
-- Created: 2026-07-19
--
-- Discovered while writing docs/architecture/api.md's CRUD reference: every
-- FK from events→leagues, pairings/standings/waitroom→events, and
-- round_results→pairings was ON DELETE CASCADE. Deleting a league silently
-- destroyed every event under it — and every pairing/standing/waitroom
-- entry/round_result under those events — with only a generic client-side
-- "are you sure?" confirm and no visibility into how much history was about
-- to be erased. The delete endpoints' own comments assumed a foreign-key
-- violation would surface (RESTRICT semantics) — it never could, since the
-- constraints were CASCADE all along.
--
-- User decision (2026-07-19): block deletion when children exist, matching
-- the existing rulesets/decks pattern (409 "in use" guard at the app layer,
-- server/api/leagues/:id/delete.post.ts and server/api/events/:id/delete.post.ts).
-- This migration is the DB-level half of that: RESTRICT is the actual
-- enforcement (defense in depth even if an app-level check has a bug); the
-- app-level guard exists only to turn the resulting error into a clean 409
-- instead of a raw 500 with a Postgres constraint-violation message.

ALTER TABLE public.events
  DROP CONSTRAINT events_league_id_fkey,
  ADD CONSTRAINT events_league_id_fkey
    FOREIGN KEY (league_id) REFERENCES public.leagues(id)
    ON DELETE RESTRICT;

ALTER TABLE public.pairings
  DROP CONSTRAINT pairings_event_id_fkey,
  ADD CONSTRAINT pairings_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(event_id)
    ON DELETE RESTRICT;

ALTER TABLE public.standings
  DROP CONSTRAINT standings_event_id_fkey,
  ADD CONSTRAINT standings_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(event_id)
    ON DELETE RESTRICT;

ALTER TABLE public.waitroom
  DROP CONSTRAINT waitroom_event_id_fkey,
  ADD CONSTRAINT waitroom_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(event_id)
    ON DELETE RESTRICT;

ALTER TABLE public.round_results
  DROP CONSTRAINT round_results_pairing_id_fkey,
  ADD CONSTRAINT round_results_pairing_id_fkey
    FOREIGN KEY (pairing_id) REFERENCES public.pairings(pairing_id)
    ON DELETE RESTRICT;
