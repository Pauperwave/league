# Todos

Loose observations and open questions — not yet committed, ranked work. For that, see `docs/BACKLOG.md`.

## Waiting list paid/companion flags: persist to localStorage (2026-07-14)

The paid/companion checkboxes in `WaitingListTable` are deliberately ephemeral ("just for remembering right in that moment" — confirmed 2026-07-14, NOT a bug); they currently vanish on page refresh, though. Persist them to **localStorage** (not the DB), keyed by event — same pattern as `useSessionStorePersistence`/`RoundTimer`: hydrate on mount, write through on change, clear when the event starts (waitroom is cleared then anyway).

## Booster pack reward per round: winner checklist + "table wins" stat (2026-07-14)

After **every** round (including the last one), the winner of each table receives a booster pack. Two parts:
- **In-room checklist**: a "boosters to hand out" todo list per round — generated from the round's table winners (rank 1 per pairing), with a check-off state so the organizer knows who has already received theirs. Probably an event-page panel or modal shown after round scores are confirmed.
- **Stat persistence**: record it on player stats as "table wins". Verify what already exists before adding anything: `standings.victories` already accumulates `position === 1` per event, and `player_stats` is trigger-computed from `round_results` — a table win is derivable as `round_results.position = 1`, so this may need **zero new columns**, just a `table_wins` aggregate in the `player_stats` trigger (or even a query). The checklist's check-off state, if it must survive refresh, can live in localStorage like the round timer.

For destructive actions (delete player/deck/league/event/waiting-list entry): show a 10-second undo toast instead of deleting immediately, and back it with **soft delete** on Supabase (`deleted_at timestamptz` column + filtered SELECTs, or a `deleted` flag) so the undo window is honest (restore = clear the flag) and accidental deletions stay recoverable beyond the toast. Needs: schema migration per table, store delete actions rewritten to soft-delete + delayed hard-confirm (or just soft-delete forever + periodic purge), `useToast` action button wiring.

## Component granularity audit (2026-07-14)

Reviewed all of `app/components/` (largest files, `fallow:health`, usage grep) while writing `app/components/CLAUDE.md`. Overall verdict: healthy — no component is a complexity hotspot, and the biggest ones (`TablePreviewModal`, `PairingsCard`) already delegate their logic to composables/subcomponents. Remaining observations:

**Intentionally unreferenced (do NOT delete):**
- ~~`event/EndedEventBadge.vue`~~ — resolved 2026-07-14: now rendered in the event page's ended phase, above the final `StandingsCard`.

**Merge candidates (over-decomposed):**
- ~~`layout/HeaderActions.vue`~~ — flagged as a logic-free wrapper inlinable into `app.vue`; decided 2026-07-14 to **keep it as-is** (preferred for readability of `app.vue`). Closed.
- Borderline, fine as-is: `layout/AppLogo.vue` (9 lines, single use, but the light/dark invert trick is worth the name) and `player/PlayersHeader.vue` (23 lines, single use, but it carries breadcrumb logic).

**Decomposition candidates:**
- ~~`event/pairing/table/score/TableScoreGrid.vue`~~ — done 2026-07-14: grid state (init, drag handlers, formation validation, rank extraction) extracted to `useRankingGrid` (`app/composables/tables/useRankingGrid.ts`) with unit tests. The `[VALID FORMATION]` console.logs are intentional debug output while the app is under test — keep them.
- `event/waiting/WaitingListTable.vue` (277 lines) — cohesive (one table + selection + batch actions); the batch-actions toolbar is the natural first cut if it grows.

**Convention drift spotted in passing:**
- ~~`event/CurrentTime.vue` auto-import reliance~~ — resolved 2026-07-14 by **inverting the convention**: `vitest.config.ts` now mirrors Nuxt's auto-imports (`unplugin-auto-import`), so source files rely on auto-imports everywhere and no sweep toward explicit imports is needed. The redundant explicit value imports that had accumulated were swept out instead. See root `CLAUDE.md`.

## Parametrization opportunities found during the i18n migration
Not urgent, just flagged while migrating strings on 2026-07-13:
- **Status→color/icon config duplicated per table.** `LeagueTable.vue`'s `statusConfig` and `EventTable.vue`'s equivalent both hardcode their own `Record<string, { color, icon, labelKey }>` mapping a stable status value to a badge color/icon/i18n key. Same shape, two copies. As of 2026-07-13, deliberately left unabstracted and formally suppressed via `// fallow-ignore-file code-duplication` in both files (see `app/components/ui/CLAUDE.md`) rather than left as silent noise in `fallow:dupes` output — still worth a shared composable (e.g. `useStatusBadge()`) if a third status-bearing entity shows up.
- **Date/number formatting isn't locale-aware.** `formatDate` and friends use hardcoded formatting rather than deriving from the active `vue-i18n` locale. Harmless while `it` is the only locale, but would need revisiting the moment a second locale is added.
