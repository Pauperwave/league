# Backlog

<!-- docs/BACKLOG.md -->

Committed, actionable work items, ranked by priority with a rough effort estimate. For loose observations/ideas that aren't yet committed work, see `docs/TODO.md`. For what's already done, see `docs/PROGRESS.md`.

**Priority:** P1 (do next) · P2 (soon) · P3 (someday)
**Effort:** S (< 1h) · M (a few hours) · L (a day+)

| # | Item | Priority | Effort |
|---|------|----------|--------|
| 1 | [E2E testing: Playwright + Playwright MCP](#1-e2e-testing-playwright--playwright-mcp) | P1 | L |
| 2 | [Redesign `TableCard.vue` layout for future player self-entry](#2-redesign-tablecardvue-layout-for-future-player-self-entry) | P1 | M |
| 3 | [Round timer alarm sound](#3-round-timer-alarm-sound) | P2 | S |
| 4 | [Form `isValid` should derive from Valibot schemas](#4-form-isvalid-should-derive-from-valibot-schemas) | P2 | M |
| 5 | [Replace native HTML5 DnD in `TableScoreGrid.vue`](#5-replace-native-html5-dnd-in-tablescoregridvue) | P3 | M |
| 6 | [Slim `useEventStore` by extracting pure logic](#6-slim-useeventstore-by-extracting-pure-logic) | P2 | M |

---

## 1. E2E testing: Playwright + Playwright MCP

- Add `@playwright/test` and a `playwright.config.ts` for E2E tests (`docs/AGENTS.md` already calls for Playwright + `@nuxt/test-utils` E2E coverage on critical flows: event creation, round progression, score submission)
- `playwright-core` is a direct devDependency but currently unused (no config or tests) — exempted in `.fallowrc.json`'s `ignoreDependencies` for exactly this reason; remove the exemption once real E2E tests land
- Set up the Playwright MCP server for browser-driven E2E authoring/debugging

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

From the 2026-07-14 data-flow review. `app/stores/events.ts` (~1300 lines) owns the full event lifecycle, pairing generation, round scoring, and standings — a god store. Per ADR-011, don't force a split of the store itself (its state genuinely is one lifecycle). Instead, continue the pattern already started at the top of the file (`fetchRoundData`, `calculateRoundScores`): whenever an action is touched, extract its **pure logic** (score calculation, round-data assembly, standings math) into module-level functions or `app/utils`, leaving the store action as thin state + DB round-trips. Pure functions get unit tests for free — 1300-line store actions never will. Incremental, opportunistic; no big-bang refactor.

---

## Closed out / resolved, not carried forward

- **Reinventing-the-wheel audit (2026-05-27):** recorded here only so the "9 of 11 fixed" count in `docs/PROGRESS.md`'s 2026-07-13 changelog entry is traceable. Fixed: `toErrorMessage()` extraction, `useEventUrl.ts`'s generic `setQueryParam`, `app/utils/math.ts`'s `roundToDecimals`/`isCloseTo`, `sanitizePlayer()` consistency, `upperFirst.ts` removed. Went moot: the Scryfall card-search composables it flagged (`useCardWhitelists`/`useCardSearch`) no longer exist — that feature was migrated to Supabase-backed data instead of patched in place.
- **`docs/bugs.md`'s table-preview-optimization bug (2026-07-13):** the report was "clicking Conferma runs table optimization and then closes the modal, but optimization should happen before the modal is shown." Checked against current code — `TablePreviewModal.vue`'s `watch(open, ...)` (lines 102-120) already auto-runs the optimizer as soon as the modal opens (gated on `loading`, guarded by `hasAutoOptimized`), and `playerOrder` is propagated through `handleConfirm` → `emit('confirm', playerOrder.value)` → `useEventLifecycle.ts`'s `nextRound(playerOrder)` — matching the fix already logged in `PROGRESS.md`'s 2026-05-26 changelog entry ("Preview mostra tavoli prima di avanzare round"). Not carried forward as a live bug.
