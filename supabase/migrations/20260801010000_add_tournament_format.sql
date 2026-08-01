-- Migration: Add tournament_format to tournaments
-- Created: 2026-08-01
--
-- Every tournament run so far is Commander, but the mtg_formats enum already
-- covers other formats (players' formats_played) and the payments overview
-- page (/payments) needs to filter tournaments by format. Default existing
-- and future rows to 'Commander' so nothing needs a manual backfill.

ALTER TABLE tournaments ADD COLUMN tournament_format mtg_formats NOT NULL DEFAULT 'Commander';
