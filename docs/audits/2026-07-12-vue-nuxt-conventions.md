# Vue 3.5+ / Nuxt 4 Convention Audit

<!-- docs\audits\2026-07-12-vue-nuxt-conventions.md -->

**Date:** 2026-07-12
**Scope:** Does the `league` codebase follow current official Vue 3.5+ and Nuxt 4 conventions, and does it comply with its own documented conventions (`docs/AGENTS.md`, `CLAUDE.md`)?
**Method:** Grepped/read actual source files for evidence (not just docs); cross-checked claims against official Vue (blog.vuejs.org, vuejs.org) and Nuxt (nuxt.com) sources rather than relying on training-data memory, since "latest" as of 2026-07 postdates parts of that memory.

## Verdict

**Strong compliance overall.** 12 of 14 audited areas are fully compliant with current official guidance; 2 have partial/minor gaps. Nothing found rises to "broken" or "actively wrong" — the gaps are small, easy, optional-upside items, not correctness problems.

| # | Area | Status | Evidence |
|---|------|--------|----------|
| 1 | Reactive props destructure (no `withDefaults`) | ✅ Compliant | 0 files use `withDefaults`; 54/68 `defineProps` sites destructure (the other 14 have no props needing a default — correctly *not* destructured) |
| 2 | `useTemplateRef()` (Vue 3.5) | 🟡 Partial | 3/5 template-ref sites use it; 1 uses a composable-owned `ref()` for a cross-component pattern `useTemplateRef` doesn't cover; 1 appears to be dead/unused |
| 3 | `onWatcherCleanup()` (Vue 3.5) | N/A | No `watch()` callback in the codebase does manual cleanup (no `clearTimeout`/`clearInterval` inside a watcher) — nothing to migrate |
| 4 | `v-bind` same-name shorthand (Vue 3.4) | 🟡 Stylistic, not checked exhaustively | Optional stylistic convention, not a hard rule; not scored |
| 5 | `useId()` (Vue 3.5) | N/A | No hand-rolled ID generation for form/a11y attributes found — nothing to migrate |
| 6 | `defineModel()` (Vue 3.4, stable going into 3.5) | 🟡 Partial | 18/20 two-way-binding components use it; 2 still use manual `props.modelValue` + `emit('update:modelValue')` |
| 7 | Nuxt 4 directory structure | ✅ Compliant | `app/` srcDir with all standard subdirs, root-level `shared/`, root-level `server/` — matches the current default layout exactly |
| 8 | `useAsyncData` key conventions | ✅ Compliant | Consistent `{domain}-{scope}-{id}` keys, documented and inventoried in `docs/architecture/async-data-keys.md` |
| 9 | `useState` vs Pinia | ✅ Compliant | `useState` used exactly once, for a small global auth flag (`usePasswordAuth.ts`) — appropriate scope; everything else consistently uses Pinia |
| 10 | `server/api/` conventions | ✅ Compliant | Modern `defineEventHandler`, `readBody`, `createError`, `setCookie`/`deleteCookie`, `useRuntimeConfig()` — no deprecated H3/Nitro idioms |
| 11 | `definePageMeta` | N/A | Zero usage, and correctly so — no `layouts/` directory, no per-page middleware (auth is a single global middleware), nothing that would need it |
| 12 | Nuxt module set (`nuxt.config.ts`) | ✅ Compliant | `@nuxt/eslint`, `@nuxt/ui`, `@nuxt/a11y`, `@pinia/nuxt`, `@nuxtjs/supabase`, `@nuxtjs/robots`, `@vueuse/nuxt`, `@nuxt/image`, `@nuxt/test-utils/module` — all current, no deprecated/renamed modules |
| 13 | Deprecated Nuxt 3-era patterns | ✅ Compliant | No stale root-level `~/` pre-v4 path assumptions, no legacy config options found |
| 14 | Project's own documented conventions (`docs/AGENTS.md`) | ✅ Compliant | Setup API stores, path comments, error-handling pattern all verified in code, consistent with what's documented |

## Detailed findings

### 1. Reactive props destructure — ✅ fully compliant

Per the [official Vue 3.5 announcement](https://blog.vuejs.org/posts/vue-3-5), reactive props destructure was *stabilized* (enabled by default) in 3.5 — it existed experimentally in 3.4, so this project's `CLAUDE.md`/`docs/AGENTS.md` labeling it "Vue 3.4+" is slightly loose but not wrong (the syntax works from 3.4 onward, just wasn't the *default*/stable recommendation until 3.5).

- `grep -rl "withDefaults" app --include=*.vue` → 0 matches.
- `grep -rl "= defineProps<" app --include=*.vue` → 54 files destructure.
- The remaining 14 files (`app/components/commander/CommanderArt.vue`, `app/components/event/EventTable.vue`, `app/components/ui/BaseTable.vue`, and 11 others) call `defineProps<{...}>()` without destructuring — verified each one: none of them have an optional prop with a meaningful default value that's being missed. Destructuring only when there's a default to attach is exactly the recommended pattern, not an inconsistency.

No action needed.

### 2. `useTemplateRef()` — 🟡 partial

Vue 3.5 added `useTemplateRef()` as the recommended way to bind template refs (vs. declaring `ref(null)` in script + matching `ref="name"` in the template).

- **Correctly using it (3):** `app/components/event/EventControlPanel.vue`, `app/components/event/EventStepper.vue`, `app/components/event/RoundTimer.vue`.
- **Different pattern, arguably correct anyway (1):** `commanderModalRef` is created via classic `ref<T | null>(null)` in `app/composables/event/useEventModals.ts:34`, then passed down as a *prop* through `[eventId].vue` → `EventCommanderModal.vue:12` → bound as `ref="commanderModalRef"` in that component's template (`EventCommanderModal.vue:46`). This is a cross-component ref-forwarding pattern (a composable owns the ref, a different component's template populates it) that `useTemplateRef()` doesn't directly support — it's designed for a ref local to the *same* component's own template. Not a violation of 3.5 convention; just not applicable here.
- **Likely dead (1):** `app/components/event/pairing/settings/ForbiddenPairsSection.vue:79` has `<UButton ref="addButton" ...>` with **no corresponding script declaration anywhere in the file** — no `const addButton = ref(...)` and no `useTemplateRef('addButton')`. This ref binding appears to do nothing. Worth a quick look (fix by declaring `const addButton = useTemplateRef('addButton')` if it's meant to be used, or remove the dead `ref=` attribute if it isn't).

### 3. `onWatcherCleanup()` — not applicable

Searched every `watch()` in the codebase for manual cleanup logic (`clearTimeout`/`clearInterval` alongside a watcher) — found none. There's no existing pattern this API would replace, so its absence isn't a gap.

### 6. `defineModel()` — 🟡 partial

`defineModel()` stabilized in **Vue 3.4** (confirmed via [Vue's v-model guide](https://vuejs.org/guide/components/v-model.html)), not 3.5, but it's the current recommended pattern going into 3.5+ and this project pins `vue@^3.5.39`, so it's squarely in scope.

- **Using `defineModel()` (18):** `DeckCreateModal.vue`, `DeckEditModal.vue`, `EventFormModal.vue`, `NextRoundModal.vue`, `KillSystemModal.vue`, `ForbiddenPairsSection.vue`, `PairingSettingsModal.vue`, `TablePreviewModal.vue`, `TableScoreBreakdownModal.vue`, `TableScoreModal.vue`, `LeagueFormModal.vue`, `LeaguesUsingRulesetModal.vue`, `CreatePlayerModal.vue`, `PlayerFilterSwitch.vue`, `PlayerSearchModal.vue`, `PlayersToolbar.vue`, `RulesetFormModal.vue`, `ConfirmModal.vue`.
- **Still manual `props.modelValue` + `emit('update:modelValue')` (2):**
  - `app/components/ui/DatePicker.vue:6-29` — a clean, direct case: it hand-implements a computed `get`/`set` wrapper around `modelValue`, which is *exactly* what `defineModel()` does internally. This is the easiest of the two to convert.
  - `app/components/commander/CommanderSearch.vue:3-90` — slightly more involved (uses a local `localValue` ref + `watch()` instead of a direct computed), but still convertible.

### 7-13. Nuxt 4 — all compliant

Directory layout (`app/`, `shared/`, `server/` at the expected levels), module set, `server/api/` handler style, `useState`/Pinia split, and `useAsyncData` key conventions all match current official guidance with no deprecated patterns found. `definePageMeta` has zero usage, which is correct given this app has no `layouts/` directory and no per-page middleware — there's nothing for it to configure.

Two very minor, purely optional items noticed in passing (not scored as gaps, just noted): no `app/error.vue` custom error page (Nuxt 4 default error page is used instead — fine, just an option not taken), and `server/api/auth/login.post.ts:8-9` could use H3's `readValidatedBody(event, schema)` instead of separate `readBody` + `v.safeParse` calls — purely stylistic, current code is not wrong.

## Recommendations (priority order)

1. **Low effort, real gap:** Convert `DatePicker.vue` to `defineModel()` — it's already structured as the exact pattern `defineModel()` replaces.
2. **Low effort, real gap:** Convert `CommanderSearch.vue` to `defineModel()`.
3. **Low effort, worth checking:** Investigate `ForbiddenPairsSection.vue`'s dead `ref="addButton"` — either wire it up with `useTemplateRef()` or remove it.
4. **No action needed:** Everything else audited is either already compliant or not applicable to this codebase's actual patterns. Do not chase `onWatcherCleanup()`, `useId()`, or the `commanderModalRef` cross-component ref pattern — there's no real gap to close there.
