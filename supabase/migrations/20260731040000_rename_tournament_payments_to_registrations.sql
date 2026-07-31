-- Migration: Rename tournament_payments to tournament_registrations, add registered_at
-- Created: 2026-07-31
--
-- The "click on the Registrazione step to view a read-only past-registration
-- table" feature needs, per player: registration timestamp + payment method.
-- The registration timestamp used to live in `waitroom.inserted_at`, but that
-- row is deleted the moment the tournament starts (see start.post.ts) — so
-- once a tournament is playing/ended, the original insertion time is gone.
--
-- Fix: snapshot it at start time into this table, same place payment_method
-- already gets snapshotted (see 20260731000000_create_tournament_payments.sql).
-- Renamed from tournament_payments since its scope is no longer payment-only —
-- a row now exists for every seated player, not just those with a payment
-- method set (payment_method becomes nullable accordingly). Rename, not
-- drop+recreate, to preserve already-recorded payment data for tournaments
-- that already ran.

ALTER TABLE tournament_payments RENAME TO tournament_registrations;

ALTER TABLE tournament_registrations ALTER COLUMN payment_method DROP NOT NULL;
ALTER TABLE tournament_registrations ADD COLUMN registered_at TIMESTAMPTZ;

ALTER POLICY "Allow authenticated read tournament_payments" ON tournament_registrations
  RENAME TO "Allow authenticated read tournament_registrations";
ALTER POLICY "Allow anon read tournament_payments" ON tournament_registrations
  RENAME TO "Allow anon read tournament_registrations";

COMMENT ON TABLE tournament_registrations IS 'Per-player registration snapshot (when they joined the waitroom, how they paid) for a tournament — written once at tournament start, never touched by standings recompute logic. registered_at is NULL for tournaments started before this column existed.';
