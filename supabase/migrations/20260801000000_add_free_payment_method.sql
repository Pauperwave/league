-- Migration: Allow 'free' as a payment_method value on tournament_registrations
-- Created: 2026-08-01
--
-- Complimentary/omaggio seats (e.g. an event sponsor, organizer freebie) are
-- not paid via pos or cash, so the original two-value CHECK constraint has
-- no way to represent them. Widen it to include 'free'.

ALTER TABLE tournament_registrations DROP CONSTRAINT tournament_payments_payment_method_check;

ALTER TABLE tournament_registrations ADD CONSTRAINT tournament_registrations_payment_method_check
  CHECK (payment_method IN ('pos', 'cash', 'free'));
