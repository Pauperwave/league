# Todos

Loose observations and open questions — not yet committed, ranked work. For that, see `docs/BACKLOG.md`.

## Component granularity audit (2026-07-14)

Reviewed all of `app/components/` (largest files, `fallow:health`, usage grep) while writing `app/components/CLAUDE.md`. Overall verdict: healthy — no component is a complexity hotspot, and the biggest ones (`TablePreviewModal`, `PairingsCard`) already delegate their logic to composables/subcomponents. Remaining observations:

**Intentionally unreferenced (do NOT delete):**
- `event/EndedEventBadge.vue` has zero references today, but it's reserved for the ended-event flow, which hasn't been built yet (decision 2026-07-14). Marked with a keep-comment in the component itself. Expect it in `fallow:dead-code` output until the flow lands.

**Merge candidates (over-decomposed):**
- ~~`layout/HeaderActions.vue`~~ — flagged as a logic-free wrapper inlinable into `app.vue`; decided 2026-07-14 to **keep it as-is** (preferred for readability of `app.vue`). Closed.
- Borderline, fine as-is: `layout/AppLogo.vue` (9 lines, single use, but the light/dark invert trick is worth the name) and `player/PlayersHeader.vue` (23 lines, single use, but it carries breadcrumb logic).

**Decomposition candidates:**
- ~~`event/pairing/table/score/TableScoreGrid.vue`~~ — done 2026-07-14: grid state (init, drag handlers, formation validation, rank extraction) extracted to `useRankingGrid` (`app/composables/tables/useRankingGrid.ts`) with unit tests. The `[VALID FORMATION]` console.logs are intentional debug output while the app is under test — keep them.
- `event/waiting/WaitingListTable.vue` (277 lines) — cohesive (one table + selection + batch actions); the batch-actions toolbar is the natural first cut if it grows.

**Convention drift spotted in passing:**
- ~~`event/CurrentTime.vue`~~ — fixed 2026-07-14: explicit `ref`/`computed`/`useIntervalFn` imports added + component test (`test/nuxt/components/event/CurrentTime.test.ts`). Other components may still rely on `<script setup>` auto-imports (works in the app, throws in `test/nuxt/**` mounts) — worth a sweep when adding tests for them.

## Parametrization opportunities found during the i18n migration
Not urgent, just flagged while migrating strings on 2026-07-13:
- **Status→color/icon config duplicated per table.** `LeagueTable.vue`'s `statusConfig` and `EventTable.vue`'s equivalent both hardcode their own `Record<string, { color, icon, labelKey }>` mapping a stable status value to a badge color/icon/i18n key. Same shape, two copies. As of 2026-07-13, deliberately left unabstracted and formally suppressed via `// fallow-ignore-file code-duplication` in both files (see `app/components/ui/CLAUDE.md`) rather than left as silent noise in `fallow:dupes` output — still worth a shared composable (e.g. `useStatusBadge()`) if a third status-bearing entity shows up.
- **Date/number formatting isn't locale-aware.** `formatDate` and friends use hardcoded formatting rather than deriving from the active `vue-i18n` locale. Harmless while `it` is the only locale, but would need revisiting the moment a second locale is added.
