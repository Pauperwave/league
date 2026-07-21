-- Migration: add optional bracket_level to commander_decks
-- Created: 2026-07-22
--
-- Lets a player self-assign a Commander bracket (1-5, per WotC's official
-- bracket system: Exhibition/Core/Upgraded/Optimized/cEDH) to a single deck.
-- Nullable — existing decks have no bracket assigned until the player sets
-- one. The CHECK constraint enforces the valid range at the DB level,
-- independent of any client-side validation.

ALTER TABLE commander_decks
  ADD COLUMN IF NOT EXISTS bracket_level SMALLINT
  CHECK (bracket_level IS NULL OR bracket_level BETWEEN 1 AND 5);
