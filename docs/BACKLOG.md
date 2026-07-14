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
| 7 | [DB-layer write security: stop trusting the anon key](#7-db-layer-write-security-stop-trusting-the-anon-key) | P2 | L |

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

## 7. DB-layer write security: stop trusting the anon key

**Architecture decided: Backend-For-Frontend — see ADR-013 in `docs/PROGRESS.md`.** This entry keeps the operational detail.

From external security feedback on the 2026-07-14 standings-write-policies migration. Current posture, stated honestly: **every app table is anon-writable and the site password is enforced only in Nuxt middleware (a cookie check) — not at the database layer.** The anon key ships in the browser bundle, so anyone who extracts it can write to the Data API directly, bypassing the password gate entirely. The standings policy added on 2026-07-14 merely matches this pre-existing posture; it didn't create the exposure.

Scoping policies per-row (e.g. `WITH CHECK (event_id = ...)`) does **not** help here — without Supabase Auth there is no JWT claim to scope against; an attacker can pass any `event_id`. The two real options:

- **(a) Preferred: move all writes behind Nuxt server routes** (`server/api/*`) using the service-role key (server-only env var), then set every app table's write policies to deny `anon`. Stores keep their public shape but call `$fetch('/api/...')` instead of `supabase.from(...)`. The password gate becomes server-enforced for writes. Big but mechanical refactor; pairs naturally with the future multi-player self-entry (BACKLOG #2), which needs a server arbiter anyway.
- **(b) Lighter: SECURITY DEFINER Postgres functions (RPCs)** that validate the site password server-side (stored in Vault/a config table, never compared client-side) and perform the writes; deny direct table writes to `anon`. Less infra, but every write path still needs rewriting to `.rpc()` calls and the password travels on every request.

**Serverless deployment constraints** (the app deploys as Nitro serverless functions — `server/api/auth/login.post.ts` already proves the pattern, with `NUXT_SITE_PASSWORD` as a server-only env var; the service-role key would live the same way):

- Server routes under (a) become serverless functions — fine, but **write endpoints must be coarse-grained**: `updateStandingsAndRanks` currently fires 2×N individual updates; as an API it should be ONE `/api/events/:id/advance-round` call that does the whole transition server-side (ideally wrapping a single Postgres RPC), not N proxied updates. This is *better* than today, not just equivalent: the round transition becomes atomic instead of a client-orchestrated sequence that can die halfway.
- **Cold starts** add occasional ~100ms–1s latency to writes. Acceptable for admin actions (score confirm, round advance); another reason to batch rather than chatter.
- **Reads stay client → Supabase direct** (RLS SELECT policies) — no function hop, read latency unchanged. Supabase Realtime (future) is also client ↔ Supabase direct, unaffected.
- Use `supabase-js` (HTTP/PostgREST) inside functions, never a direct Postgres connection pool — serverless + pg pools = connection exhaustion.
- Option (b) has one serverless-specific appeal: RPCs go client → PostgREST directly, so latency-sensitive in-room writes skip the function hop and cold starts entirely. If (a)'s cold starts ever hurt during live rounds, a hybrid (in-room writes via password-validating RPCs, admin/lifecycle writes via server routes) is legitimate.

**API design principles** (decided in discussion 2026-07-14):

- **Endpoints are intent-based, never table-based.** They name domain actions from the event lifecycle (`advance-round`, `turn-back-round`, `register-player`, `confirm-table-scores`), not tables. This is what makes them stable across DB schema changes: rename/split columns, add soft-delete, move logic into a Postgres function — the URL, request body, and response shape don't move; only the route's internals do. **No generic CRUD proxies** (`PATCH /api/standings/:id`) — those mirror table shapes and churn with every migration. Rule of thumb: an endpoint name containing a table name instead of a verb is probably wrong.
- **Stores become thin API clients; their public shape doesn't change.** Reads stay `supabase.from().select()` client-direct (read-only policies, `initialized` caching untouched). Write actions swap the orchestration for one `$fetch('/api/...', { method: 'POST' })`; the route returns the fresh rows it wrote and the store assigns them — local state mirrors what the server actually did instead of an optimistic guess. The `{ success, error? }` convention survives unchanged (`createError` → `$fetch` throws → existing `catch`/`toErrorMessage`/toast path). Session stores and `useAsyncData` composables are untouched.
- **The orchestration logic moves, it doesn't die** — `calculateRoundScores`/`updateStandingsAndRanks` etc. relocate into the server route, mostly copy-paste since they're already module-level pure functions (BACKLOG #6 is de facto preparation for this).
- **Shared valibot schemas** (`shared/`) validate the form client-side and the request body server-side (`login.post.ts` precedent) — overlaps with BACKLOG #4.
- **SSR gotcha for the eventual CLAUDE.md rule:** writes are client-initiated; an SSR-time internal `$fetch` doesn't forward the `site-auth` cookie — use `useRequestFetch()` if that ever comes up.
- **Migrate in slices, not big-bang**: standings/round-lifecycle writes first (where atomicity matters most); the security win completes only when the anon write policies flip to deny, table by table.
- **Slice progress:** `register-player` done 2026-07-14 (`server/api/events/[eventId]/register-player.post.ts` — cookie gate, valibot body, registration-open guard, duplicate skip, server-truth response; store is a thin `$fetch` client). Still using the anon key server-side — switch it to `serverSupabaseServiceRole` + deny anon writes on `waitroom` (needs `SUPABASE_SERVICE_KEY` env) to complete. Next slices: `advance-round`, `turn-back-round`, `confirm-table-scores`.
- Rejected alternatives, for the record: Supabase Edge Functions (second runtime/deploy pipeline for zero gain over the existing Nitro functions); RPC-first (logic in SQL couples schema and logic migrations — kept only as the in-room latency escape hatch).
- **Planned future (decided 2026-07-14, not hypothetical): Supabase Auth with per-player accounts.** When player self-entry (BACKLOG #2) gives players real identities, RLS with JWT claims becomes meaningful and completes the picture — it *complements* the BFF (per-row authorization on self-service writes), it does not replace it: multi-step transitions still want the server arbiter. Design new endpoints with this in mind (e.g. don't bake "there is only one admin caller" assumptions into request bodies).

Until one of these lands, the exposure is accepted (friends-league app, data recoverable from `round_results`/backups) but **known** — don't present the RLS policies as a security boundary in docs.

- **Reinventing-the-wheel audit (2026-05-27):** recorded here only so the "9 of 11 fixed" count in `docs/PROGRESS.md`'s 2026-07-13 changelog entry is traceable. Fixed: `toErrorMessage()` extraction, `useEventUrl.ts`'s generic `setQueryParam`, `app/utils/math.ts`'s `roundToDecimals`/`isCloseTo`, `sanitizePlayer()` consistency, `upperFirst.ts` removed. Went moot: the Scryfall card-search composables it flagged (`useCardWhitelists`/`useCardSearch`) no longer exist — that feature was migrated to Supabase-backed data instead of patched in place.
- **`docs/bugs.md`'s table-preview-optimization bug (2026-07-13):** the report was "clicking Conferma runs table optimization and then closes the modal, but optimization should happen before the modal is shown." Checked against current code — `TablePreviewModal.vue`'s `watch(open, ...)` (lines 102-120) already auto-runs the optimizer as soon as the modal opens (gated on `loading`, guarded by `hasAutoOptimized`), and `playerOrder` is propagated through `handleConfirm` → `emit('confirm', playerOrder.value)` → `useEventLifecycle.ts`'s `nextRound(playerOrder)` — matching the fix already logged in `PROGRESS.md`'s 2026-05-26 changelog entry ("Preview mostra tavoli prima di avanzare round"). Not carried forward as a live bug.
