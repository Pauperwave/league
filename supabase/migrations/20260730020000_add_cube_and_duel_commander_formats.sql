-- supabase\migrations\20260730020000_add_cube_and_duel_commander_formats.sql
ALTER TYPE mtg_formats ADD VALUE IF NOT EXISTS 'Duel Commander';
ALTER TYPE mtg_formats ADD VALUE IF NOT EXISTS 'Cubo Vintage';
ALTER TYPE mtg_formats ADD VALUE IF NOT EXISTS 'Cubo Commander';
ALTER TYPE mtg_formats ADD VALUE IF NOT EXISTS 'Premodern';
