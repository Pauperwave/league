# Prompt for AI Assistant: MTG League App — Code Quality Improvements

## Project Overview

You are working on a **Magic: The Gathering league management app** built with:
- **Nuxt 3** (Vue 3, TypeScript, Composition API with `<script setup>`)
- **Pinia** for state management
- **Supabase** for database
- **Tailwind CSS** + **Nuxt UI v4** for styling
- **PNPM** as package manager

The codebase follows these conventions:
- Path comments at the top of every source file (e.g., `// app\utils\slug.ts`)
- Composition API exclusively, no Options API
- JSDoc on all Pinia stores
- Error handling pattern: return `{ success: boolean, error?: string, data?: T }` from stores
- UI text in Italian, code/logs in English

## Task

Fix the "reinventing the wheel" issues identified in a codebase audit. These are instances where the codebase manually implements functionality already provided by installed libraries or existing utilities.

**Working directory:** `C:\Users\emanuelenardi\Documents\Coding\MagicTheGathering\league`

---

## Issues to Fix (in priority order)

### 🔴 P1: Extract shared `toErrorMessage()` utility

**Problem:** The error extraction pattern `err instanceof Error ? err.message : 'fallback string'` is copy-pasted ~15 times across 4 stores.

**Files to modify:**
- Create: `app/utils/error.ts` with `toErrorMessage(err: unknown, fallback = 'Unknown error'): string`
- Update: `app/stores/players.ts` (4 places), `app/stores/leagues.ts` (4 places), `app/stores/rulesets.ts` (4 places), `app/stores/commander-decks.ts` (4 places)
- Note: `app/stores/events.ts` already has this inline at line 13-15 — extract from there too

**What to do:** Replace every inline error extraction with a call to `toErrorMessage()`. Import from `~/utils/error`.

---

### 🔴 P2: Replace raw `fetch` with `$fetch` / `ofetch`

**Problem:** Raw `fetch()` calls without `response.ok` checks will silently fail on 4xx/5xx and try to parse error HTML as JSON.

**Files to modify:**
- `app/composables/useCardWhitelists.ts` — line 67
- `app/composables/useCardSearch.ts` — lines 87, 167, 211, 273

**What to do:** Replace `fetch(url)` + `.json()` with `$fetch(url)`. `$fetch` is already globally available in Nuxt (from `ofetch`) and throws on non-2xx automatically. Remove manual JSON parsing — `$fetch` returns parsed JSON.

---

### 🟡 P3: Use existing `localStorage.ts` utility in `useCardWhitelists`

**Problem:** `app/composables/useCardWhitelists.ts` lines 11-52 has a private `getCached`/`setCached` implementation that's identical to `app/utils/localStorage.ts` but without generics and with extra `console.log` noise.

**What to do:** Remove the private cache functions and import `getCached<T>` / `setCached<T>` from `~/utils/localStorage`.

---

### 🟡 P4: Extract shared `round()` and `isCloseTo()` math utilities

**Problem:** Manual math patterns are duplicated and use magic numbers.

**Files to extract from:**
- `app/composables/supabase/useDeckStats.ts:76` — `Math.round((value / count) * 10) / 10`
- `app/composables/supabase/usePlayerStats.ts:72` — same pattern
- `app/composables/useCardWhitelists.ts:27` — same pattern
- `app/composables/event/usePairingPresets.ts:24-26` — `Math.abs(a - b) < 0.001`
- `app/composables/event/useOptimizationNotifier.ts:31` — same epsilon pattern

**What to do:**
- Create `app/utils/math.ts` with:
  ```ts
  export function roundToDecimals(value: number, decimals = 1): number {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
  }
  
  export function isCloseTo(a: number, b: number, epsilon = 0.001): boolean {
    return Math.abs(a - b) < epsilon
  }
  ```
- Replace all inline usages with these utilities.

---

### 🟡 P5: Use `sanitizePlayer()` consistently

**Problem:** Inline `.replace(/_/g, ' ')` appears 3 times in `app/stores/players.ts` (lines 76-79, 108-111, 144-147) even though `sanitizePlayer()` already exists in the same file.

**What to do:** Replace all inline underscore replacement with calls to the existing `sanitizePlayer()` function.

---

### 🟡 P6: Use `URLSearchParams` for URL construction

**Problem:** Manual template-literal URL in `app/composables/event/useEventPage.ts:184-186`:
```ts
router.push(`/league/${leagueId}/event/${eventId}/round/${currentRound.value}/score?pairingId=${pairingId}&playerId=${playerId}&tableId=${tableId}`)
```

**What to do:** Use `URLSearchParams` or `navigateTo({ path, query })` to safely encode query parameters.

---

### 🟢 P7: Replace `upperFirst.ts` with library

**Problem:** `app/utils/upperFirst.ts` is a trivial one-liner maintained by us.

**What to do:** Check if `es-toolkit` is already installed. If not, install it (`pnpm add es-toolkit`). Replace usages of `upperFirst` with `es-toolkit/upperFirst`. Delete `app/utils/upperFirst.ts`.

---

## Constraints

- **Do NOT change any APIs or component props** — all changes should be internal refactorings.
- **Run `pnpm lint` after each batch of changes** and fix any new errors.
- **Run `pnpm typecheck` after all changes** to ensure no TypeScript regressions.
- **Do NOT modify test logic** — if a test file uses an old import path, update the import but preserve test behavior.
- **Follow existing code style** — path comments, Italian UI strings, English code comments.

## Libraries Already Available (do not add unless noted)

- `valibot` — schema validation (dev dependency)
- `ofetch` — HTTP via Nuxt `$fetch` (built-in)
- `vue-draggable-plus` — drag and drop
- `slugify` — URL slug generation

## Verification Checklist

After completing all items:
- [ ] `pnpm lint` passes with 0 errors, 0 warnings
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (if tests exist for modified files)
- [ ] All modified files have the `// app\...` path comment at the top
- [ ] No dead code introduced (check with `pnpm dead-code`)

---

*Audit document reference: `docs/reinventing-the-wheel.md` contains full details on each finding.*
