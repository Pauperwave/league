-- Migration: add configurable round duration to events
-- Created: 2026-07-13

alter table public.events
  alter column event_round_duration set default 75;

update public.events
set event_round_duration = 75
where event_round_duration is null;