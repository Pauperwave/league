-- Migration: add configurable round duration to events
-- Created: 2026-07-12

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_round_duration INTEGER;

COMMENT ON COLUMN events.event_round_duration IS 'Round duration in minutes; app falls back to a default (75) when null';
