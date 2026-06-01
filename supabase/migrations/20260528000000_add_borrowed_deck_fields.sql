-- Migration: add borrowed deck support to commander_decks
-- Created: 2026-05-28

-- Add is_borrowed boolean flag (default false = owned by player)
ALTER TABLE commander_decks
  ADD COLUMN IF NOT EXISTS is_borrowed BOOLEAN NOT NULL DEFAULT FALSE;

-- Add lender_id foreign key to players table (nullable)
ALTER TABLE commander_decks
  ADD COLUMN IF NOT EXISTS lender_id INTEGER REFERENCES players(player_id) ON DELETE SET NULL;

-- Add index for lender lookups
CREATE INDEX IF NOT EXISTS idx_commander_decks_lender_id
  ON commander_decks(lender_id);

-- Add index for borrowed decks filter
CREATE INDEX IF NOT EXISTS idx_commander_decks_is_borrowed
  ON commander_decks(is_borrowed);
