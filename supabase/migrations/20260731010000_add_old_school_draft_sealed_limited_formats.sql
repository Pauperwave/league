-- supabase\migrations\20260731010000_add_old_school_draft_sealed_limited_formats.sql
ALTER TYPE mtg_formats ADD VALUE IF NOT EXISTS 'Old School';
ALTER TYPE mtg_formats ADD VALUE IF NOT EXISTS 'Draft';
ALTER TYPE mtg_formats ADD VALUE IF NOT EXISTS 'Sealed';
ALTER TYPE mtg_formats ADD VALUE IF NOT EXISTS 'Limited';
