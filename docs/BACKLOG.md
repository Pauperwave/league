# Backlog

<!-- docs/BACKLOG.md -->

Committed, actionable work items, ranked by priority with a rough effort estimate. For loose observations/ideas that aren't yet committed work, see `docs/TODO.md`. For what's already done, see `docs/PROGRESS.md`.

**Priority:** P1 (do next) · P2 (soon) · P3 (someday)
**Effort:** S (< 1h) · M (a few hours) · L (a day+)

| # | Item | Priority | Effort |
|---|------|----------|--------|
| 1 | [Test coverage strategy and missing tests](#1-test-coverage-strategy-and-missing-tests) | P1 | L |
| 2 | [Redesign `TableCard.vue` layout for future player self-entry](#2-redesign-tablecardvue-layout-for-future-player-self-entry) | P1 | M |
| 3 | [Round timer alarm sound](#3-round-timer-alarm-sound) | P2 | S |
| 4 | [Form `isValid` should derive from Valibot schemas](#4-form-isvalid-should-derive-from-valibot-schemas) | P2 | M |
| 5 | [Replace native HTML5 DnD in `TableScoreGrid.vue`](#5-replace-native-html5-dnd-in-tablescoregridvue) | P3 | M |
| 6 | [Slim `useEventStore` by extracting pure logic](#6-slim-useeventstore-by-extracting-pure-logic) | P2 | M |

---

## 1. Test coverage strategy and missing tests

**Full picture (what's tested today, gap by gap): `docs/architecture/testing.md`. Playwright E2E scaffolding done 2026-07-19 (see below) — this item now also tracks the overall coverage strategy and the concrete backlog of missing tests across all three layers.**

### Strategy (decided 2026-07-19)

Three layers, each with a different target — not "100% everywhere":

- **Unit** (`test/unit/`): target near-100% of **pure/complex logic** — scoring, pairing/ranking algorithms, validation, formatting. This is already the strongest layer (10 files, well-covered). Deliberately **not** chasing coverage on thin Colada query/mutation wrappers (`useXQuery.ts` files that are essentially a one-line `useQuery({...})`) — unit-testing those mostly tests the mock, not real behavior; they're better verified by API/E2E actually hitting them.
- **API/integration** (new tier, not yet started): Playwright's `request` fixture hitting `server/api/*` endpoints directly, no browser/UI. Much cheaper than a full E2E spec per endpoint — closes the "0 of 23 server endpoints have direct coverage" gap fast. Candidate location: `test/api/` (sibling to `test/e2e/`), reusing `test/e2e/helpers/testTag.ts`/`cleanup.ts`.
- **Component** (`test/nuxt/`): not a current priority tier — the 3 existing tests are shallow and that's an acceptable state for now given the other two layers have bigger, higher-value gaps.
- **E2E** (`test/e2e/`): full flows through the real UI against production (see scaffolding notes below). Priority order: **event lifecycle first** (create → register players → start → advance-round → submit scores → turn-back-round → end) — the most stateful, most bug-prone path, and the one that already surfaced 3 real bugs this session (refresh-vs-refetch staleness, RLS policy drift, cascade-delete data loss) — then the remaining entity CRUD (rulesets, decks, players; leagues done).

### Missing tests — concrete checklist

**API/integration (new tier — 0 of 23 endpoints covered directly):**
- [ ] `POST /api/events/*` — create, update, delete (with the new 409 in-use guard), start, advance-round, turn-back-round, register-player, unregister-player
- [ ] `POST /api/pairings/:id/*` — rankings, kills, commander, votes
- [ ] `POST /api/decks/*` — create, update, delete (409 in-use guard)
- [ ] `POST /api/players/*` — create, update
- [ ] `POST /api/rulesets/*` — create, update, delete (409 in-use guard)
- [ ] `POST /api/auth/login` — success + wrong-password cases

**E2E (1 of ~5 major flows covered):**
- [ ] Event lifecycle: create event → register players → start (round-1 pairings generated) → submit round scores (rankings/kills/commander/votes) → advance-round → turn-back-round → end event
- [ ] Ruleset CRUD (mirror of `league-crud.e2e.spec.ts`)
- [ ] Deck CRUD, including the 409 in-use guard when a deck has been played
- [ ] Player create/edit (no delete — none exists, see `api.md`)
- [ ] League/event delete blocked with children present (409, post-2026-07-19 RESTRICT migration) — currently only verified manually, not in an automated spec

**Unit — pure logic still untested (lower priority than the above two, but real gaps):**
- [ ] `app/utils/error.ts` (`toErrorMessage`, `isConflictError`)
- [ ] `app/utils/localStorage.ts` (TTL expiry, corrupt/missing cache)
- [ ] `app/utils/slug.ts`
- [ ] `app/composables/tables/useTableCalculator.ts` (table-size math feeding the pairing optimizer and waitroom estimate)
- [ ] Pinia stores: `app/stores/events.ts` (lifecycle) and the 4 session stores (`rankings`, `kills`, `votes`, `commanders`) have no dedicated test file today — only exercised via hand-built fakes in `useSessionStorePersistence.test.ts`

### E2E scaffolding notes (2026-07-19)

- `@playwright/test` installed, `playwright.config.ts` at repo root, `pnpm test:e2e` / `pnpm test:e2e:headed` scripts. `playwright-core` (the old unused-dependency placeholder) removed — `@playwright/test` brings its own.
- **Runs against the real production Supabase project** — this repo has no local Supabase/Docker stack available, and the user decided (2026-07-19) production is an acceptable target as long as pre-existing data is never touched. Every test-created entity is tagged (`test/e2e/helpers/testTag.ts`, `E2E TEST ... <timestamp>`) and deleted in `test.afterEach` regardless of outcome (`test/e2e/helpers/cleanup.ts`, never throws — logs loudly instead so a cleanup failure can't silently mask itself).
- **`webServer` runs the production build (`pnpm build && node .output/server/index.mjs`), not `pnpm dev`** — the dev server (Vite/Nitro) was observed returning empty-body error responses for a real, correctly-rejected request (a schema-valid-looking update 400'd with no parseable body); the built server handled the identical flow correctly and ~3x faster. Worth remembering if a future spec mysteriously fails only in dev.
- **Not using `@nuxt/test-utils/playwright`'s `nuxt` fixture** — it manages its own separate Nuxt build/instance, which conflicted with (and timed out alongside) `webServer`. Plain `@playwright/test` + a `page.waitForLoadState('networkidle')` after each `goto` (to let Nuxt hydration finish before interacting — filling a field before hydration means the `v-model` listener isn't attached yet and the submit button never enables) is simpler and sufficient.
- Auth: `test/e2e/global.setup.ts` logs in once via the real site-password gate and saves `storageState`, reused by every spec project.
- Visual debugging: `pnpm test:e2e:headed` (PW_SLOWMO=1 under the hood, via `cross-env` for Windows/PowerShell) runs headed with a 2s delay between actions.
- First spec (`test/e2e/league-crud.e2e.spec.ts`): create → edit → delete a league via the real UI, response-body assertions on each write, verified clean (no orphaned data) after every run.
- Playwright MCP server setup for browser-driven E2E authoring/debugging: not done yet.

---

## 2. Redesign `TableCard.vue` layout for future player self-entry

Carried over from a since-deleted `docs/bugs.md` (open design ask, no fixed spec — needs a proposal, not just an implementation).

`app/components/event/pairing/table/TableCard.vue` (used inside `TableScoreGrid.vue`/`TablePreviewGrid.vue`) needs a layout pass:
- The top-left `UIcon`/`ICONS.tableView` badge (`TableCard.vue:50`) was called out as superfluous — reconsider whether it earns its space.
- Design with an upcoming feature in mind: **players will eventually enter their own commander(s) and votes directly** (rankings and kills stay admin-entered). The current layout wasn't built with player-facing self-service inputs in mind — figure out what changes (touch targets, input affordances, permission-gated fields) that requires before it's built, not after.
- No fixed spec yet — propose 1-2 layout options before implementing.

---

## 3. Round timer alarm sound

`RoundTimer.vue` (and `TimerControlButton.vue`) are already implemented and working — this item is only about adding an audible/notification alarm when a round's timer expires, which isn't built yet:

```ts
// composables/useAlarmSound.ts
export function useAlarmSound() {
  const { show, isSupported } = useWebNotification({
    title: 'Tempo scaduto!',
    body: 'Il round è terminato.',
    icon: '/favicon.ico',
  })

  function play() {
    // Web Audio beeps (plays when tab is visible)
    const ctx = new AudioContext()
    const now = ctx.currentTime
    const beep = (t: number, freq: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.4, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.start(t)
      osc.stop(t + dur)
    }
    beep(now,       880, 0.3)
    beep(now + 0.4, 660, 0.3)
    beep(now + 0.8, 440, 0.6)

    // System notification (plays when tab is in background)
    if (isSupported.value) show()
  }

  return { play }
}
```

Wire into `RoundTimer.vue`'s expiry check:

```ts
const { play: playAlarm } = useAlarmSound()

const { pause, resume } = useIntervalFn(() => {
  if (!startTime.value) return
  elapsed.value = Math.floor((Date.now() - startTime.value) / 1000)
  if (isExpired.value) {
    pause()
    playAlarm()
    emit('expired')
  }
}, 1000, { immediate: false })
```

---

## 4. Form `isValid` should derive from Valibot schemas

Carried over from a since-deleted `docs/reinventing-the-wheel.md` audit (2026-05-27).

`LeagueFormModal.vue`, `CreatePlayerModal.vue`, and `RulesetFormModal.vue` each hand-write an `isValid` computed (e.g. `!!form.name.trim()`) instead of deriving it from the existing Valibot schema (`v.safeParse`/`v.is`). Risk: the form can be "submittable" per the UI but fail schema validation, or vice versa.

---

## 5. Replace native HTML5 DnD in `TableScoreGrid.vue`

Carried over from the same since-deleted `docs/reinventing-the-wheel.md` audit.

`app/components/event/pairing/table/score/TableScoreGrid.vue` hand-rolls native `draggable="true"`/`@dragstart`/`@dragover`/`dataTransfer` handling instead of the already-installed `vue-draggable-plus` (`^0.6.1`, used elsewhere for table card reordering) — more verbose and less cross-browser-consistent than the library.

---

## 6. Slim `useEventStore` by extracting pure logic

From the 2026-07-14 data-flow review. `app/stores/events.ts` owns the full event lifecycle, pairing generation, and round scoring — a god store. Per ADR-011, don't force a split of the store itself (its state genuinely is one lifecycle). Instead, continue the pattern already started (`fetchRoundData`, `calculateRoundScores`, now in `shared/utils/roundScoring.ts`): whenever an action is touched, extract its **pure logic** (score calculation, round-data assembly, standings math) into module-level functions, `app/utils`, or `shared/utils`, leaving the store action as thin state + API/DB round-trips. Pure functions get unit tests for free — long inline store actions never will. Incremental, opportunistic; no big-bang refactor. **Progress check 2026-07-17**: the ADR-013 BFF waves moved round scoring server-side and the store is down to ~755 lines from the original ~1300 — the strategy is working; keep applying it opportunistically.

---

## Historical notes

- **Reinventing-the-wheel audit (2026-05-27):** recorded here only so the "9 of 11 fixed" count in `docs/PROGRESS.md`'s 2026-07-13 changelog entry is traceable. Fixed: `toErrorMessage()` extraction, `useEventUrl.ts`'s generic `setQueryParam`, `app/utils/math.ts`'s `roundToDecimals`/`isCloseTo`, `sanitizePlayer()` consistency, `upperFirst.ts` removed. Went moot: the Scryfall card-search composables it flagged (`useCardWhitelists`/`useCardSearch`) no longer exist — that feature was migrated to Supabase-backed data instead of patched in place.
- **`docs/bugs.md`'s table-preview-optimization bug (2026-07-13):** the report was "clicking Conferma runs table optimization and then closes the modal, but optimization should happen before the modal is shown." Checked against current code — `TablePreviewModal.vue`'s `watch(open, ...)` (lines 102-120) already auto-runs the optimizer as soon as the modal opens (gated on `loading`, guarded by `hasAutoOptimized`), and `playerOrder` is propagated through `handleConfirm` → `emit('confirm', playerOrder.value)` → `useEventLifecycle.ts`'s `nextRound(playerOrder)` — matching the fix already logged in `PROGRESS.md`'s 2026-05-26 changelog entry ("Preview mostra tavoli prima di avanzare round"). Not carried forward as a live bug.
