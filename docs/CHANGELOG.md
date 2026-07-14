<!-- docs\CHANGELOG.md -->
# Changelog

One entry per notable commit, newest first, grouped by date. Each entry: the commit subject (gitmoji convention, see `.githooks/commit-msg`), then what/why bullets. This complements `PROGRESS.md` (curated ADRs and per-area status): the changelog is the raw commit-by-commit trail, `PROGRESS.md` is the distilled history — fold important outcomes there, keep the play-by-play here.

## 2026-07-14

### `feat(api): 🔊 structured logging in the BFF endpoints`

- `[api/advance-round]` and `[api/register-player]` prefixed logs at every step (request received, scoring input sizes, per-player updated scores, event advanced/ended, pairings created, and every failure with its context) — visible in the `pnpm dev` terminal (or serverless function logs in production). Client side, the stores log `[useEventStore] advance-round ok` / `[usePlayerStore] register-player ok` with the server's response, so the browser console tells the same story.

### `feat(event): ✨ wire NextRoundModal into the advance flow`

- The advance button (relabeled "Avanti" → "Procedi al prossimo round") now opens `NextRoundModal` as the action confirmation; confirming hands over to the table preview, which runs the optimizer and supplies the `playerOrder` the advance-round endpoint requires. This also removes the dead path where `confirmNextRound` called `nextRound()` bare — which the endpoint now rejects (400, `playerOrder` required) unless the event is ending. Last-round flow (end-event confirm) unchanged.

### `feat(api): ✨ BFF slice 2 — atomic advance-round endpoint (ADR-013)`

- New `POST /api/events/:eventId/advance-round`: owns the whole round transition server-side — score the closing round, accumulate standings (with the 0-rows RLS guard), advance or end the event in one update, insert next-round pairings from the confirmed `playerOrder`. Domain guards: playing phase, and a round-mismatch 409 (double-submit/stale-tab protection the client never had).
- Scoring/pairing helpers moved to `shared/utils/roundScoring.ts` (isomorphic — typed on `SupabaseClient<Database>`); `events.ts` slims by ~200 lines and `nextRound` becomes a thin `$fetch`. The pairing optimizer deliberately stays client-side (device-local localStorage preferences); the preview modal's confirmed order travels in the body.
- `@supabase/supabase-js` added as a direct dependency pinned to `2.110.3` (the version `@nuxtjs/supabase` resolves) — the `SupabaseClient` class types nominally, so two package instances don't unify; keep the pin in sync when updating the module.
- Discovered: `NextRoundModal` is never opened (nothing sets `showNextRoundModal = true`) — every real advance goes through the preview (order present) or end-event (no pairings). Left as-is for now.

### `feat(api): ✨ first BFF slice — register-player endpoint (ADR-013)`

- New `server/api/events/[eventId]/register-player.post.ts`: enforces the `site-auth` cookie server-side, valibot-validates the body, guards the domain rule (registration open, event not playing), skips duplicates, and returns the rows it wrote. Coarse-grained: one call registers N players.
- `usePlayerStore.addToWaitingList(eventId, playerIds[])` is now a thin `$fetch` client — local state set from the server response (`inserted_at` from the DB, not a client-side guess); its `catch` finally returns a real `error` message (was `{ success: false }` with a blank toast). `useEventPage` drops its per-player loop.
- Still on the anon key server-side — flipping `waitroom` to deny anon writes (service-role key) completes the slice, per BACKLOG #7.

### `docs(conventions): 📝 async action buttons — loading-auto + explicit success check`

- Root `CLAUDE.md`: bare `<UButton>`s triggering store mutations use `loading-auto` (spinner/disable driven by the `@click` promise — no double-clicks during atomic transitions) with an explicit `{ success, error }` check and toasts; `ui/CLAUDE.md`: the wrapper buttons (`ConfirmButton`/`CancelButton`) keep the explicit `:loading` prop — their synchronous `click` re-emit breaks the promise chain `loading-auto` needs. Toast `icon`s must come from `ICONS.*`.

### `docs(adr): 📝 ADR-013 — Backend-For-Frontend for DB writes`

- New ADR in `PROGRESS.md`: BFF pattern decided (intent-based Nitro endpoints own write orchestration; stores become thin API clients; reads stay client-direct). Supabase Auth with per-player accounts recorded as the **planned future** (complements the BFF for self-entry authorization, doesn't replace it) — upgraded from hypothetical in `BACKLOG.md` #7, which now cross-references the ADR.

### `docs(api): 📝 record the API design principles for the write-hardening refactor`

- `BACKLOG.md` #7 completed with the decided design: intent-based endpoints (stable across DB schema changes; no CRUD proxies), stores as thin API clients (same public shape, server response as local truth), orchestration logic relocating server-side, shared valibot schemas, SSR cookie gotcha, slice-by-slice migration, and the rejected alternatives with reasons.

### `docs(security): 📝 add serverless constraints to the DB-write hardening plan`

- `BACKLOG.md` #7 extended for the serverless deploy (Nitro functions, precedent: `server/api/auth/login.post.ts`): coarse-grained write endpoints (one atomic `advance-round` call, not N proxied updates), cold-start tolerance, reads/Realtime stay client-direct, `supabase-js` over pg pools in functions, and a legitimate hybrid with password-validating RPCs for latency-sensitive in-room writes.

### `docs(security): 📝 record DB-write exposure honestly; deletion-undo TODO`

- `BACKLOG.md` #7: the site password is app-layer only — every app table is anon-writable via the Data API. Real fixes are server routes + service-role key (preferred, pairs with player self-entry) or SECURITY DEFINER RPCs; per-row `WITH CHECK` scoping is security theater without auth claims. Security note added to the standings migration.
- `TODO.md`: 10-second undo toast for deletions backed by Supabase soft delete.

### `fix(standings): 🐛 surface silently-failing standings score updates`

- Bug: the final "Classifica" showed 0 points for everyone and standings appeared to reset every round. Root cause: `updateStandingsAndRanks` never checked the Supabase `error` of its UPDATEs, **and** an update filtered out by RLS (no UPDATE policy for `anon` on `standings` — the repo migrations only ever created SELECT policies) reports *no error and 0 rows*, so every score write vanished silently.
- Fix: score updates now `.select()` the affected rows, throw on any error, and throw a descriptive error if fewer rows were updated than expected (turning the silent failure into a visible toast); rank updates also propagate errors.
- New idempotent migration `20260714000000_add_standings_write_policies.sql` adds `FOR ALL` write policies on `standings` for `anon`+`authenticated` — **not yet applied to the live DB** (needs `supabase db push` or the dashboard SQL editor).

### `feat(event): ✨ show EndedEventBadge in the event page's ended phase`

- `EndedEventBadge` (previously reserved/unreferenced) now renders above the final `StandingsCard` when `eventStatus === 'ended'`; keep-comment and `TODO.md` entry resolved.

### `style(comments): ✏️ translate remaining Italian comments to English`

- `nuxt.config.ts` and `test/helpers/mocks.ts` — repo-wide grep found no other Italian code comments.

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
