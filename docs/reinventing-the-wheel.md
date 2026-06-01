# Codebase Audit: Reinventing the Wheel

> Generated 2026-05-27 from automated scan of `app/`, `shared/`, `composables/`, `utils/`, `stores/`, `components/`

This document catalogs instances where the codebase manually implements functionality already provided by well-known, battle-tested libraries — or by existing utilities within the project itself.

---

## Legend

| Severity | Meaning |
|----------|---------|
| 🔴 **High** | Bug-prone, violates DRY, or introduces maintenance burden. Fix first. |
| 🟡 **Medium** | Reduces readability or consistency. Fix when touching related code. |
| 🟢 **Low** | Minor duplication or one-liner. Fix opportunistically. |

---

## 🔴 High Severity

### 1. Six Copy-Pasted URL Query Sync Functions

- **Files:** `app/composables/event/useEventUrl.ts` (lines 19-165)
- **What:** `syncUrl`, `syncPreview`, `syncScoreModal`, `syncKillModal`, `syncVotesModal`, and `syncCommanderModal` are ~95% identical boilerplate: iterate `Object.entries(route.query)`, filter out a hardcoded key, optionally set a new value, then `router.replace({ query: newQuery })`.
- **Impact:** ~130 lines of copy-pasted code. Any change to query-string behavior (e.g., preserving arrays) requires editing six places instead of one.
- **Fix:** Extract a single generic helper:
  ```ts
  function setQueryParam(key: string, value: string | null) {
    const query = { ...route.query }
    if (value === null) delete query[key]
    else query[key] = value
    router.replace({ query })
  }
  ```
  Or use `@vueuse/router` `useRouteQuery`.

---

### 2. Manual `isValid` Computed Properties Duplicating Valibot Schemas

- **Files:**
  - `app/components/modals/EventFormModal.vue:74`
  - `app/components/modals/CreatePlayerModal.vue:45`
  - `app/components/modals/LeagueFormModal.vue:59`
  - `app/components/modals/RulesetFormModal.vue:68-75`
- **What:** Hand-written validation logic that mirrors the `v.pipe(v.string(), v.trim(), v.minLength(1))` constraints already defined in the Valibot schemas.
- **Impact:** The form can be "submittable" according to the UI but then fail schema validation (or vice-versa). Keeping two sources of truth for the same rules is a classic source of bugs.
- **Fix:** Use `valibot` (already in `devDependencies`):
  ```ts
  const isValid = computed(() => v.is(EventFormSchema, form))
  // or
  const parseResult = computed(() => v.safeParse(EventFormSchema, form))
  ```

---

### 3. Raw `fetch` Without Error Handling

- **Files:**
  - `app/composables/useCardWhitelists.ts:67`
  - `app/composables/useCardSearch.ts:87, 167, 211, 273`
- **What:** `await fetch(url)` followed by `.json()` — no check for `response.ok`. Fetch does **not** throw on 4xx/5xx, so the code will try to parse error HTML/JSON and silently fail or crash downstream.
- **Impact:** Silent failures on API errors, cryptic "Unexpected token" errors when parsing HTML error pages.
- **Fix:** Use `$fetch` / `ofetch` (already bundled with Nuxt). Throws on non-2xx by default, has built-in retry, JSON parsing, and timeout.
  ```ts
  // Before
  const res = await fetch(url)
  const data = await res.json()
  // After
  const data = await $fetch(url)
  ```

---

### 4. Inline Error Message Extraction Copy-Pasted ~15×

- **Files:**
  - `app/stores/players.ts:83, 117, 156, 180`
  - `app/stores/leagues.ts:67, 93, 128, 157`
  - `app/stores/rulesets.ts:46, 71, 102, 143`
  - `app/stores/commander-decks.ts:49, 110, 141, 165`
- **What:** `err instanceof Error ? err.message : 'fallback string'` repeated everywhere.
- **Impact:** The exact same 2-line logic is duplicated across 4 stores. A fix to the pattern (e.g., handling `PostgrestError` differently) requires editing ~15 places.
- **Fix:** Extract the existing `toErrorMessage()` already defined in `app/stores/events.ts:13-15` to `app/utils/error.ts` and import everywhere.
  ```ts
  // app/utils/error.ts
  export function toErrorMessage(err: unknown, fallback = 'Unknown error'): string {
    return err instanceof Error ? err.message : fallback
  }
  ```

---

## 🟡 Medium Severity

### 5. Duplicated localStorage TTL Cache Implementation

- **Files:** `app/composables/useCardWhitelists.ts:11-52`
- **What:** A private `getCached(key, ttlMs)` / `setCached(key, data)` pair that is identical in logic to `app/utils/localStorage.ts` but with extra `console.log` statements and without generics.
- **Fix:** Import and use `app/utils/localStorage.ts` (`getCached<T>` / `setCached<T>`).

---

### 6. Manual HTML5 Drag-and-Drop in a Grid

- **Files:** `app/components/events/Pairings/TableScoreGrid.vue:75-298`
- **What:** Native HTML5 DnD API (`draggable="true"`, `@dragstart`, `@dragover`, `@drop`, `dataTransfer`, manual column constraint checks).
- **Fix:** Use `vue-draggable-plus` (already in `dependencies`) or `@vueuse/components` `useDraggable`. Less verbose, more accessible, cross-browser consistent.

---

### 7. Repeated Manual "Round to N Decimals" Pattern

- **Files:**
  - `app/composables/supabase/useDeckStats.ts:76`
  - `app/composables/supabase/usePlayerStats.ts:72`
  - `app/composables/useCardWhitelists.ts:27`
- **What:** `Math.round((value / count) * 10) / 10`
- **Impact:** Intent not immediately obvious, duplicated 3 times, no NaN/Infinity guards.
- **Fix:** Use `es-toolkit/round` or `lodash/round`:
  ```ts
  import { round } from 'es-toolkit'
  const avg = round(value / count, 1)
  ```

---

### 8. Manual Query-String URL Construction

- **Files:** `app/composables/event/useEventPage.ts:184-186`
- **What:** Template-literal URL construction:
  ```ts
  router.push(`/league/${leagueId}/event/${eventId}/round/${currentRound.value}/score?pairingId=${pairingId}&playerId=${playerId}&tableId=${tableId}`)
  ```
- **Impact:** Brittle — if `pairingId` contains special characters it won't be encoded.
- **Fix:** Use `URL` + `URLSearchParams` or Nuxt's `navigateTo({ path, query })`:
  ```ts
  const query = new URLSearchParams({ pairingId, playerId, tableId })
  router.push(`/league/${leagueId}/event/${eventId}/round/${currentRound.value}/score?${query}`)
  ```

---

### 9. Manual Epsilon / Float Equality Checks

- **Files:**
  - `app/composables/event/usePairingPresets.ts:24-26`
  - `app/composables/event/useOptimizationNotifier.ts:31`
- **What:** Inline `Math.abs(a - b) < 0.001` with a hardcoded epsilon.
- **Impact:** Magic number `0.001` scattered in two files. Intent not explicit.
- **Fix:** Extract a shared utility:
  ```ts
  export function isCloseTo(a: number, b: number, epsilon = 0.001): boolean {
    return Math.abs(a - b) < epsilon
  }
  ```

---

### 10. Repeated Inline Underscore Replacement

- **Files:** `app/stores/players.ts:76-79, 108-111, 144-147`
- **What:** Inline `.replace(/_/g, ' ')` in `fetchPlayers`, `createPlayer`, and `updatePlayer` — even though `sanitizePlayer()` already exists in the same file.
- **Fix:** Use `sanitizePlayer()` consistently everywhere. The inline logic and the utility will drift if sanitization rules ever change.

---

## 🟢 Low Severity

### 11. Manual `upperFirst` String Utility

- **Files:** `app/utils/upperFirst.ts:1-3`
- **What:** `str.charAt(0).toUpperCase() + str.slice(1)` in its own file.
- **Fix:** Use `es-toolkit/upperFirst` or `lodash/upperFirst`. Already a well-tested one-liner, but at least it's not maintained by us.

---

## Summary by Category

| Category | Count | Highest Severity |
|----------|-------|-----------------|
| URL / Query Strings | 2 | 🔴 |
| Validation | 1 | 🔴 |
| HTTP / API | 1 | 🔴 |
| Error Handling | 1 | 🔴 |
| Caching | 1 | 🟡 |
| DnD / UI | 1 | 🟡 |
| Math / Numbers | 2 | 🟡 |
| String Utilities | 2 | 🟡 / 🟢 |

---

## Recommended Action Order

1. **Extract `toErrorMessage`** → fix 15 inline copies at once
2. **Generic query param helper** → collapse 6 sync functions into 1
3. **Use Valibot for form validity** → eliminate duplicated validation rules
4. **Replace raw `fetch` with `$fetch`** → fix silent API failures
5. **Adopt `localStorage.ts` utility** → remove duplicated cache logic
6. **Extract `round()` and `isCloseTo()` helpers** → deduplicate math patterns
7. **Use `URLSearchParams`** → fix brittle URL construction
8. **Use `vue-draggable-plus`** → replace native DnD (already installed)
9. **Use `sanitizePlayer()` consistently** → fix DRY violation
10. **Replace `upperFirst.ts`** → use library (lowest priority)

---

## Libraries Already Available

Before adding any new dependency, remember these are already installed:

| Library | Already Used For |
|---------|-----------------|
| `valibot` | Schema validation in modals |
| `ofetch` (via Nuxt `$fetch`) | HTTP requests |
| `vue-draggable-plus` | Table card reordering |
| `slugify` | URL slug generation |

Consider adding:
- `es-toolkit` — tree-shakeable lodash alternative for `round`, `upperFirst`, `clamp`, `groupBy`, etc.

---

*Last updated: 2026-05-27*
