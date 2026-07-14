<!-- docs\CHANGELOG.md -->
# Changelog

One entry per notable commit, newest first, grouped by date. Each entry: the commit subject (gitmoji convention, see `.githooks/commit-msg`), then what/why bullets. This complements `PROGRESS.md` (curated ADRs and per-area status): the changelog is the raw commit-by-commit trail, `PROGRESS.md` is the distilled history — fold important outcomes there, keep the play-by-play here.

## 2026-07-14

### `chore(release): 🔖 bump version to 0.3.0`

- Minor bump for the consistency-audit batch: auto-import convention inversion + 124-file sweep, logging unification, `PairingsCard` store injection, props two-branch rule, routing/fallow/path-header cleanups.

### `refactor(types): ♻️ derive TableScoreGrid's DatabasePlayer from the generated Player row`

- `interface DatabasePlayer { ... }` (hand-declared, already drifted: `formats_played: string[]` vs the real enum array) → `Pick<Player, 'player_id' | 'player_name' | 'player_surname'>`, narrowed to the fields actually used. Schema drift now fails at typecheck. (`WaitingListTable`'s `WaitingPlayer` was inspected and left alone — it's a view model built by the parent, not a DB-row duplicate.)

### `chore(fallow): 🔨 clean up dead-code false positives`

- `version-bump-hook.mjs` marked `fallow-ignore-file unused-file` (it's the Claude Code Stop hook, not an importable module).
- `vue-i18n` added to `.fallowrc.json` `ignoreDependencies` — after the import sweep it *looks* test-only, but it's deliberately a direct dependency so the vitest AutoImport preset resolves (see root `CLAUDE.md`).
- `pnpm fallow:dead-code` now exits clean.

### `chore(scripts): 🔨 extend check-file-paths to test/ and scripts/; backfill headers`

- `check-file-paths.mjs` now also scans `test/` and `scripts/` (and handles `.mjs`); ran `--fix` to backfill the missing path headers in the pre-existing test files.

### `docs(routes): 📝 document the deliberate [id] vs [leagueId] param mismatch`

- Verified against the Nuxt pages docs ("named parent routes take priority over nested dynamic routes"): `league/[leagueId].vue` would pair with the `league/[leagueId]/` folder as a nested parent and shadow the event page. Warning comment added at the top of `app/pages/league/[id].vue`; repo-specific explanation added to `docs/architecture/routes.md` § Nested Route Gotchas.

### `docs(conventions): 📝 props two-branch rule (defaults → destructure, no defaults → interface Props)`

- Root `CLAUDE.md` props section rewritten: defaults needed → reactive destructure (Vue 3.5+); no defaults → named `interface Props` + `defineProps<Props>()`; the two may combine; `withDefaults` stays banned. The 15 existing `interface Props` components are compliant under this rule — no code changes.

### `refactor(event): ♻️ inject session stores directly in PairingsCard`

- Dropped the four optional store props (`rankings`, `killsStore`, `commandersStore`, `votesStore`) — Pinia stores are singletons, so the prop indirection bought no isolation and forced `props.killsStore?.` chains everywhere. Now injected via `useXStore()` like the `kill/` siblings; the single usage in the event page lost four bindings.

### `refactor(logging): ♻️ unify console logging through logger utils`

- All component/composable/page debug `console.log`s → `logDebug(component, ...)` (dev-only, `[component]`-prefixed): commander components, `KillFlowCanvas`, `KillSystemModal`, `TableScoreGrid`, `useEventPlayers`, `useRankingGrid`, `LeagueDetailPage`.
- `useEventPage`'s bare `console.error(result.error)` → `logError('useEventPage', ...)`.
- `events.ts`'s `[upsertRoundResult]` logs gained the mandated `[useEventStore]` prefix (stores keep raw console per their own convention).
- Untouched by design: `[BUTTON CLICK]` (`useButtonLogging`) and `[ROUTE CHANGE]` (`route-logger` plugin) — deliberate patterns.

### `refactor(imports): ♻️ sweep redundant value imports across app/ (124 files)`

- Codemod removed now-redundant value imports (`vue`, `vue-i18n`, `pinia`, `@vueuse/core`, `~/composables/*`, `~/utils/*`, `#imports`) from 124 files; mixed imports collapsed to `import type`.
- Added `vueTemplate: true` to the vitest AutoImport mirror — values referenced only in `<template>` (e.g. `ICONS`) compile to `_ctx` lookups that the script transform alone doesn't cover.

### `build(test): 🔧 mirror Nuxt auto-imports in vitest; invert explicit-import convention`

- Added `unplugin-auto-import` to `vitest.config.ts` (presets `vue`/`vue-i18n`/`pinia`/`@vueuse/core` + dirs `app/composables/**`, `app/utils`, `app/stores`) so plain `@vue/test-utils` mounts compile like the app; KEEP IN SYNC comments cross-linking both configs.
- Convention inverted (root/`components`/`composables`/`utils` CLAUDE.md rewritten): rely on auto-imports for values; type imports, `#shared/`, and SFC component imports stay explicit; Nuxt runtime composables still need per-test stubs.

### `docs(changelog): 📝 add commit-by-commit changelog`

- Created this file; documented its relationship to `PROGRESS.md` above; indexed it in `docs/README.md`.

### `feat(stores): ✨ add session store persistence and hydration logic` (12086f0, backfilled)

- Session stores (`rankings`, `kills`, `votes`, `commanders`) now survive a mid-round refresh: new `useSessionStorePersistence` mirrors them to localStorage (one key per event, round embedded in the snapshot so round changes self-invalidate — ADR-012).
- Every session store gained `hydrate(snapshot)` — the single entry point future Supabase Realtime will feed (`BACKLOG.md` #2).
- Map/Set mutation unified to in-place style (defensive `new Map(...)` copies removed); fixed latent `KillFlowCanvas` bug (watched `killsStore.kills` by reference — died on first `removeKill`).
- Extracted `useRankingGrid` from `TableScoreGrid.vue` (309 → ~160 lines) with unit tests; `CurrentTime.vue` got a component test.
- New `app/components/CLAUDE.md` (folder taxonomy, naming, auto-import); component granularity audit in `TODO.md`; version 0.1.2 → 0.2.0.
