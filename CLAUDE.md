# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Nuxt 4 web app for managing **Magic: The Gathering Commander leagues**: rulesets, leagues, events/tournaments, waiting-list registration, pairings, live scoring, standings, and in-room flows (score/kill/commander/vote modals). UI strings are Italian; code, comments, logs, and docs are English.

## Commands

```bash
pnpm dev                             # dev server (localhost:3000)
pnpm build                           # production build
pnpm lint                            # eslint . — must be 0 warnings/0 errors before handing off work
pnpm lint:fix
pnpm typecheck                       # nuxt typecheck (vue-tsc) — must be 0 errors before handing off work
pnpm test                            # vitest run (all tests)
pnpm test:unit                       # vitest run test/unit
pnpm test:nuxt                       # vitest run test/nuxt
pnpm test:watch
pnpm vitest run path/to/file.test.ts # single test file
pnpm fallow:dead-code                # unused exports/files
pnpm fallow:audit                    # full complexity/duplication audit (JSON)
pnpm fallow:health                   # health report with hotspots/targets
```

**Policy: 0 warnings, 0 errors** on both `pnpm lint` and `pnpm typecheck` at all times — this is enforced in CI (`.github/workflows/ci.yml` runs lint + typecheck on every push). Don't leave a warning/error behind, including in files you didn't directly intend to touch (e.g. from a shared type change). If a fix isn't safe to make blindly (would require guessing at a DB schema, or silently changes behavior), stop and flag it rather than suppressing with `eslint-disable`/`@ts-ignore`/`any`.

Never run destructive DB operations (CREATE/ALTER/DROP) without explicit user approval — see `docs/AGENTS.md`.

## Nested CLAUDE.md files

Read the relevant one before working in that directory — each covers what isn't obvious from a single file in isolation:

| File | Read before |
|------|-------------|
| [`app/stores/CLAUDE.md`](app/stores/CLAUDE.md) | Adding or modifying a Pinia store |
| [`app/composables/CLAUDE.md`](app/composables/CLAUDE.md) | Adding, moving, or renaming a composable |
| [`app/utils/CLAUDE.md`](app/utils/CLAUDE.md) | Writing a new small helper function anywhere in the app |

## Architecture

**Data flow: PostgreSQL (Supabase) → Pinia store → composable → Vue component.** Components never call `supabase` directly — always through a store action. Full detail in `docs/architecture/state-flow.md`.

- **Stores** (`app/stores/`, Pinia Setup API only) split into two categories: *Supabase stores* (`leagues`, `rulesets`, `players`, `player-stats`, `events`, `commander-decks`) hold persistent data with `initialized` flags and `{ success, error?, data? }` returns; *Session stores* (`rankings`, `kills`, `votes`, `commanders`) hold ephemeral per-round UI state (`Map`/`Set`-based) and implement `reset()`. `useEventStore` (`app/stores/events.ts`) is the largest — it owns the full event lifecycle (registration → playing → ended), pairing generation, and score/standings calculation. See [`app/stores/CLAUDE.md`](app/stores/CLAUDE.md) before adding or modifying a store.
- **Composables** (`app/composables/`) wrap store calls in `useAsyncData` for SSR. Notable ones: `event/useEventPage.ts` orchestrates the entire event page (multiple stores + composables), `event-pairing/pairingOptimizer.ts` is the greedy+local-swap pairing algorithm (see below), `event/useEventUrlSync.ts` persists modal state to URL query params (`docs/architecture/modal-url-sync.md`). See [`app/composables/CLAUDE.md`](app/composables/CLAUDE.md) for auto-import behavior and folder organization before adding one.
- **Nuxt 4 layout**: `app/` is the source root (components, pages, composables, stores, middleware, utils all live under it). Components are auto-imported with prefix stripped (`nuxt.config.ts` → `pathPrefix: false`), composables are auto-imported recursively.
- **Auth**: a single global site password gate, not per-user auth — `app/middleware/password.global.ts` checks a `site-auth` cookie and redirects to `/login` if absent.
- **Event lifecycle**: state (`registration` / `playing` / `ended`) is derived from `event_playing`, `event_current_round`, `event_registration_open` — not a separate enum column. Full phase-by-phase DB mutations in `docs/architecture/event-flow.md`.
- **Pairing optimizer** (`app/composables/event-pairing/pairingOptimizer.ts`): scores table assignments on strength balance, novelty, rematch avoidance, 3-player-table rotation, and table-size preference, each independently tunable via `PairingWeights`. Per-table player scores always sum exactly to the table total — see the invariant comment at the top of that file before touching the weighting logic; the two weighting patterns in there (early- vs late-applied) are intentional, not inconsistent.
- **Database**: all tables have RLS enabled with explicit `anon`/`authenticated` SELECT policies; `player_stats`, `deck_stats`, and the `commander_stats` materialized view are denormalized and auto-recalculated by triggers on `round_results` changes — never write to them directly. Migrations live in `supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`, idempotent). Full detail in `docs/architecture/database.md`.

## Conventions worth knowing

- **Props**: inline type in `defineProps<{...}>()`, not a separate `interface Props`. Defaults via reactive destructuring (Vue 3.4+), not `withDefaults`:
  ```ts
  const {
    totalScore,
    loading = false
  } = defineProps<{
    totalScore: number;
    loading?: boolean
  }>()
  ```
  `vue/require-default-prop` is disabled in `eslint.config.mjs` — it doesn't understand this destructure-default syntax and misfires on every optional prop with no meaningful default. Don't add a dummy `= undefined` to silence it; the rule is off on purpose.
- **Path aliases**: `~/` → `app/`, `#shared/` → `shared/` (e.g. `#shared/utils/types`, `#shared/utils/types/database` for the raw generated types), `#test/` → `test/` (added to `nuxt.config.ts` `alias` so `nuxt typecheck` resolves it, not just vitest), `#components` → Nuxt's auto-generated component registry. When in doubt, check `nuxt.config.ts`'s `alias` block and the `supabase.types` option rather than guessing.
- Add a path comment as the first line of every source file: `<!-- app\components\X.vue -->` or `// app\stores\x.ts`.
- Before writing a new small helper function, check [`app/utils/CLAUDE.md`](app/utils/CLAUDE.md) — it's a maintained inventory of existing generic helpers (error formatting, logging, caching, slugs, time formatting, etc.) kept there specifically to avoid reimplementing them.
- No backward-compatibility shims — this project is unpublished with no external consumers. Rename/delete cleanly and update call sites rather than leaving a re-export behind.
- `useAsyncData` keys follow `{domain}-{scope}-{id}` — see `docs/architecture/async-data-keys.md` for the full inventory before adding a new one (collisions have happened).
- Composables returning refs used in templates: destructure at the top of `<script setup>`, don't keep the composable's return value as a single nested object (refs won't auto-unwrap in the template).
- **Button click logging**: interactive buttons pair with `useButtonLogging(label, context?)` (`app/composables/ui/useButtonLogging.ts`) → `.logClick()` on click, logging `{ button, timestamp, ...context }` via `console.log('[BUTTON CLICK]', ...)`. `context` values can be getter functions, evaluated lazily at click time — used ~16 places, mainly form submit/cancel buttons. Follow this pattern for new form/modal actions rather than a bare `@click` handler with no logging.
- **Toasts**: `useToast().add({ title, description?, color })` with Italian `title`/`description` and `color: 'success' | 'error' | 'warning'`. Success toast right after a store mutation succeeds; on failure, `color: 'error'` with `description: result.error`.
- **Nuxt/Vue auto-imports (composables, `app/utils/` constants, even Vue reactivity APIs like `computed`/`ref`) always need an explicit `import` in source files — never rely on auto-import.** This project's component tests (`test/nuxt/**`) mount via plain `@vue/test-utils` `mount()`, which bypasses Nuxt's Vite auto-import transform *and* Vue's own compiler-macro auto-imports entirely; anything relying on auto-import (`useI18n`, `computed`, `ICONS`) is `undefined`/throws there — see `BaseButton.vue`'s explicit `import { computed } from 'vue'` for precedent. A `config.global.mocks` shim in `test/setup.ts` was tried and reverted — it only patches Vue's render context (`_ctx.xxx` template lookups), not raw `.ts`-module or `<script setup>` references, so it doesn't actually cover the failure mode. Explicit imports at each call site are the real fix — see [`app/utils/CLAUDE.md`](app/utils/CLAUDE.md) (`ACTION_MAP`, `toErrorMessage`, `ICONS`).
- **i18n translated prop defaults**: `defineProps()` defaults are hoisted by the Vue SFC compiler and **cannot reference locally-declared `<script setup>` consts** (e.g. `const { t } = useI18n()` then `label = t('common.cancel')` as a prop default) — throws a `[@vue/compiler-sfc]` compile error, not just a lint/type issue. Instead, leave the prop as plain optional/undefined and resolve the translated fallback in a `computed()`:
  ```ts
  const { label } = defineProps<{ label?: string }>()
  const { t } = useI18n()
  const displayLabel = computed(() => label ?? t('common.cancel'))
  ```
  `useI18n` itself needs an explicit `import { useI18n } from 'vue-i18n'` (it's a direct dependency — `@nuxtjs/i18n`'s `useI18n` is just `export * from 'vue-i18n'`, and the module aliases `'vue-i18n'` in the real Nuxt build via `nuxt.options.alias`, which `vitest.config.ts` doesn't have, so it must be a real resolvable package for tests too). Components using `useI18n()` also need the plugin actually installed when mounted in `test/nuxt/**` — use `createI18nTestPlugin(messages)` from `test/helpers/mocks.ts` in `global.plugins`, passing only the keys that component actually uses.
- `fallow` (`pnpm fallow:*`) is a complexity/duplication/dead-code auditor, not a linter — it's a separate signal from `eslint`/`tsc`. See the "Common Agent Workflow" section of `docs/AGENTS.md` for how to act on its findings; `.fallowrc.json` defines its entry points and exclusions (notably `shared/utils/types/database.ts`, since that file is meant to be regenerated, not hand-maintained — see the note below; and `i18n/i18n.config.ts`, which `fallow` can't see is used because Nuxt loads it via a string path in `nuxt.config.ts`'s `i18n.vueI18n` option, not a static import).
  - **Glob patterns in `.fallowrc.json` (`ignorePatterns`, `duplicates.ignore`, `health.thresholdOverrides[].files`, etc.) can't use literal `[...]` for Nuxt's dynamic-route folder names** (`[leagueId]`, `[id]`, `[deckSlug]`) — the glob engine reads square brackets as a character class, not literal text. Backslash-escaping (`\\[leagueId\\]`) does not work either (silently fails to match, likely a Windows path-separator conflict since `\` is also the native separator). The fix: replace each literal `[`/`]` with a `?` wildcard instead — e.g. `app/pages/league/?leagueId?/event/?eventId?.vue` — which matches correctly. Always verify a bracket-path glob actually took effect (re-run the relevant `fallow` command and confirm the file dropped out of the report) rather than trusting the config alone.
- **All UI-facing Italian strings live in `i18n/locales/it.json`** (a plain JSON file, lazy-loaded by `@nuxtjs/i18n` — not inline in `i18n/i18n.config.ts`, which now only holds non-message options like `{ legacy: false, locale: 'it' }`). Add new keys there, nested by domain (`league.*`, `event.*`, `store.*`, etc.), then consume with `const { t } = useI18n()` + `t('domain.key')`. `langDir`/`file` in `nuxt.config.ts` resolve relative to `restructureDir` (default `'i18n'`), so the file's real path is `i18n/locales/it.json`, not `<root>/locales/it.json` — verify against the module's own source (`node_modules/@nuxtjs/i18n/dist/module.mjs`) before changing this, not from memory.
  - **Pinia stores can call `useI18n()` too** (verified empirically) — it works as long as the store is first instantiated from within a component's synchronous `setup()`, which is this app's universal pattern (`const xStore = useXStore()` at the top of a page/component). Call it once near the top of the store's `defineStore(id, () => { ... })` factory and every nested function in that closure can use `t` freely.
  - **Functions reachable from a Pinia store action or an async `useAsyncData`/`fetch` callback are NOT safe** to call `useI18n()` from directly (no synchronous component instance at that point). Pattern: capture `t` synchronously in the calling composable (safe, since composables run inside a component's `setup()`), then pass the already-resolved string — or a small formatter callback — down as a parameter. See `usePlayerMatchHistory.ts`'s `fetchPlayerMatchHistory(supabase, playerId, unknownEventName)` and `useTableCalculator.ts`'s `formatTableEstimate(tables4, tables3, format, conjunction)` (the latter is reachable from `pairingOptimizer.ts`'s `optimizePairings()`, itself called from a `useEventStore` action — do not add `useI18n()` there).
  - **Module-scope consts are evaluated at import time, outside any component's `setup()`**, so they can't call `useI18n()` either (e.g. `ACTION_MAP` in `app/utils/actionButton.ts`, formerly `SORT_OPTIONS` in `usePlayersFilter.ts`). Store translation *keys* there instead and resolve `t(key)` at the consuming component's own `setup()`.
  - DB-persisted enum-like values are **data, not translatable UI copy** — leave them as literal strings and translate only at display time via a label-key lookup. `leagues.status` is `'scheduled'`/`'active'`/`'ended'` (lowercase English codes, matched exactly in `LeagueTable.vue`'s `statusConfig` and `useLeagues.ts`'s create default — deliberately renamed 2026-07-13 from the original Italian values `'Programmata'`/`'Attiva'`/`'Terminata'`, requiring a matching one-time DB data migration).
- **Do not upgrade `typescript` past `^5.9.x` for now.** `@nuxt/ui@4.9.0` declares a peer dependency of `typescript@^5.6.3`; TypeScript 6.x already conflicts with it (documented upstream, requires `--legacy-peer-deps` to force), and 7.0 is a much bigger jump (Microsoft's native/Go-ported compiler rewrite, not just a version bump). Wait for `@nuxt/ui`/`vue-tsc` to explicitly widen their peer range before touching this.
- `shared/utils/types/database.ts` is meant to be generated (`npx supabase gen types typescript ...`, see `README.md`), not hand-edited. It was hand-patched once, deliberately, on 2026-07-12 to unblock typechecking on a migration that hadn't been applied to the live DB yet (see `docs/PROGRESS.md` ADR-008) — treat that as an exception, not the normal workflow, and prefer regenerating for real when DB access is available.

## Documentation

`docs/README.md` is the maintained index of everything else (stores, component hierarchy, routes, database/RLS, event flow, async-data keys, URL sync, known bugs/TODOs). Start there for anything beyond this file. The subsystem-reference docs (stores, component hierarchy, routes, database, event flow, state flow, async-data keys, URL sync) live under `docs/architecture/`. Treat these docs as generally reliable but verify against the current code for anything load-bearing — they can drift after refactors (e.g. `docs/architecture/stores.md`'s store count was stale after a folder reorg).

`docs/TODO.md`, `docs/BACKLOG.md`, and `docs/PROGRESS.md` have distinct roles — don't blur them:
- **`docs/TODO.md`**: forward-looking, scratch, not yet committed. Loose observations, open questions, in-progress migration notes. Fine for it to be messy/verbose. If an observation turns into a real, plannable task, promote it into `BACKLOG.md` rather than letting it grow into a de facto task list here.
- **`docs/BACKLOG.md`**: forward-looking, committed. Actionable work items ranked by priority (P1/P2/P3) with a rough effort estimate (S/M/L) — this is where "do next" lives, not `TODO.md`.
- **`docs/PROGRESS.md`**: backward-looking, curated. Once a backlog item is actually done, fold a summary into `PROGRESS.md` (either its own ADR-#### entry for an architectural decision, or a line in the relevant existing section) and remove the corresponding `BACKLOG.md` entry rather than leaving it duplicated in both files.
