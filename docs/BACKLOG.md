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
| 7 | [Soft delete for leagues/events (and possibly decks)](#7-soft-delete-for-leaguesevents-and-possibly-decks) | P3 | L |
| 8 | [Rename event → tournament; decouple tournament from league](#8-rename-event--tournament-decouple-tournament-from-league) | P3 | L |
| 9 | [Adopt `nuxt-echarts` for charts](#9-adopt-nuxt-echarts-for-charts) | P3 | M |
| 12 | [Idempotency guards on advance-round/start/round-result submission](#12-idempotency-guards-on-advance-roundstartround-result-submission) | P1 | M |
| 14 | [Persist an explicit table number instead of deriving it from array order](#14-persist-an-explicit-table-number-instead-of-deriving-it-from-array-order) | P3 | M |
| 15 | [Winner checklist + `table_wins` stat (booster pack reward per round)](#15-winner-checklist--table_wins-stat-booster-pack-reward-per-round) | P2 | M |

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

**E2E (3 of ~5 major flows covered, 2 fully, 1 create-only):**
- [ ] Event lifecycle: create event → register players → start (round-1 pairings generated) → submit round scores (rankings/kills/commander/votes) → advance-round → turn-back-round → end event
- [ ] Ruleset CRUD (mirror of `league-crud.e2e.spec.ts`)
- [x] Deck create (`deck-create.e2e.spec.ts`, 2026-07-19) — edit and the 409 in-use guard when a deck has been played still open
- [x] Player create (`player-create.e2e.spec.ts`, 2026-07-19) — no edit UI exists on `/players` and no delete endpoint exists (see `api.md`), so this flow is now fully covered
- [ ] League/event delete blocked with children present (409, post-2026-07-19 RESTRICT migration) — currently only verified manually, not in an automated spec

**Unit — pure logic still untested (lower priority than the above two, but real gaps):**
- [ ] `app/utils/error.ts` (`toErrorMessage`, `isConflictError`)
- [ ] `app/utils/localStorage.ts` (TTL expiry, corrupt/missing cache)
- [ ] `app/utils/slug.ts`
- [x] `app/composables/tables/useTableCalculator.ts` (2026-07-22) — `calculateTables`/`getTableSizes`/`buildPreviewTables`/`formatTableEstimate`
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

## 7. Soft delete for leagues/events (and possibly decks)

Raised 2026-07-19, same session as the RESTRICT-cascade fix (see `docs/PROGRESS.md` and `database.md`'s "Key Insight" section). Today, leagues/events with children are hard-blocked from deletion (409 + app-level guard) rather than cascading — safe, but all-or-nothing: an admin can't remove a league/event from the active lists without either deleting every child first or leaving it around forever, and a genuine mistake (delete-then-regret) has no recovery path short of restoring from a Supabase backup.

A `deleted_at timestamptz null` column (leagues/events, maybe decks) instead of/alongside the hard-delete path would let "delete" mean "hide from active lists" rather than "gone" — reversible, and it sidesteps the FK/RESTRICT question entirely since the row still physically exists for `round_results`/`standings` to join against. Needs real design before implementing, not just a migration:

- Which entities actually need it. Leagues/events are the motivating case (real incident history this session); players have no delete at all; decks already have a working 409 guard and lower stakes.
- What "deleted" means for every read path — anon SELECT policies, the Colada query composables, admin-facing lists vs. historical standings/match-history joins (a soft-deleted league's events should probably still resolve in a player's match history, just not show up in `/leagues`).
- Whether it fully replaces the RESTRICT+409 guard (soft delete never needs to block on children — there's nothing to cascade) or coexists with it for entities that should still be truly unrecoverable in some cases.
- A restore path (UI + endpoint), or this is one-way hiding with no way back except direct SQL — decide explicitly rather than defaulting into it.

**Deliberately P3/someday, not next**: same reason as #8 — the standing priority is making the *current* event lifecycle rock solid first.

---

## 8. Rename event → tournament; decouple tournament from league

Raised 2026-07-19. "Event" is the wrong word for what this domain concept actually is — a **tournament**: currently modeled as always belonging to exactly one league (`events.league_id`), but a tournament should be able to:

- belong to a league (today's only shape), **or**
- be linked to a single one-off event with no league, **or**
- stand completely alone, tied to neither a league nor an event.

This is two separate large changes bundled together: (1) a naming rework — DB table/column names, TS types (`Event`, `EventInsert`, ...), every route (`/league/[leagueId]/event/[eventId]`), every composable/component/i18n key with "event" in the name — and (2) a real schema/FK change making the league relationship optional and auditing every place that currently assumes "an event always has a league" (pairing generation, standings aggregation, waitroom, breadcrumbs, `api.md`/`database.md` docs). Underestimating this as "just a rename" would be a mistake — the FK optionality change touches the pairing/standings/waitroom stack much more deeply than the name does.

**Deliberately P3/someday, not next**: the standing priority is making the *current* event lifecycle (registration → playing → round advance → ended) rock solid first. Don't start this rename until that's true; a big rename on top of a shaky lifecycle compounds risk instead of reducing it.

---

## 9. Adopt `nuxt-echarts` for charts

Raised 2026-07-19. No charting library exists in the project today (`package.json` has none) — stats are currently all numbers/badges/tables (`StatTile`, `player_stats`/`deck_stats`/`commander_stats`, standings tables). `nuxt-echarts` would give a Nuxt module wrapping Apache ECharts for actual visualizations: standings/points trends across rounds, a player's score history over time, commander win-rate/pick distribution, etc.

Needs a first concrete use case before pulling in the dependency (don't add a charting library speculatively) — natural candidates once picked: the player profile page (score/kills trend across `matchHistory`) or a league-level standings-over-rounds view. Effort estimate assumes just the module setup + one real chart, not a general charting overhaul.

---

## 12. Idempotency guards on advance-round/start/round-result submission

Found 2026-07-20, event-lifecycle fragility audit. None of `advance-round`, `start`, or round-result submission (`upsertRoundResult`) have a DB-level uniqueness constraint or an idempotency check — only a client-trusted "is the round what you think" comparison (TOCTOU, not a lock):

- ~~`advance-round`: round score is **added** to existing standings, not set absolutely — a retried call before `event_current_round` advances double-counts that round's score.~~ — **fixed 2026-07-21** (see `docs/TODO.md` #11 / ADR in `docs/PROGRESS.md`): `fetchRoundData` now recomputes standings from scratch over every round through `currentRound` instead of adding onto the persisted value, which makes `advance-round` naturally idempotent to retries and turn-back/re-advance cycles alike.
- `start`: no unique constraint on `standings (event_id, player_id)` — a retried call could insert a second full set of standings rows.
- Round-result submission: no unique constraint on `round_results (pairing_id, player_id)` — a duplicate row inflates `samePositionCount` in `calculateRoundScores` (`shared/utils/roundScoring.ts`), skewing the rank-split math for every player at that table, not just the duplicate.

Confirmed: zero duplicates exist in production today (checked directly) — this is a latent risk, not a manifested corruption. The main client-side trigger (double-click on the lifecycle buttons) is now closed — see `docs/PROGRESS.md`'s 2026-07-20 entry — but that's a store-level in-memory guard, not a DB constraint: it doesn't protect against two different tabs/sessions, or a direct API retry bypassing the store entirely. This item stays open for the remaining two bullets.

**TDD approach**: write API tests that call each endpoint twice in a row (the realistic double-click/retry scenario) and assert the *second* call is a no-op or a clean rejection, not a second mutation. Fix via unique constraints (`standings (event_id, player_id)`, `round_results (pairing_id, player_id)`) plus upsert-on-conflict logic.

---

## 14. Persist an explicit table number instead of deriving it from array order

Raised 2026-07-20, while building `PairingsFullscreenView.vue`. The `pairings` table has no `table_number`/`pairing_table_number` column at all — every place that shows "Tavolo N" (the normal `PairingsCard.vue` grid, `ConfirmModal` subjects, the new fullscreen view) derives it from the array position of the fetched `pairings` list.

This works reliably **today** because: `usePairingsQuery` explicitly orders by `.order('pairing_id')`, and each round's pairings are written in a single batch `INSERT` (`buildPairingRows`) — Postgres assigns identity-sequence values in row order for a single insert, so `pairing_id` order matches table-assignment order, and turn-back-round deletes+recreates a round's pairings as a whole batch each time, never partially. Verified not a live bug — but it's an *implicit* guarantee, not one the schema enforces. Any future change to how pairings are queried, filtered, paginated, or batched could silently break table numbering everywhere at once, without a type error or an obvious symptom until someone notices "Tavolo 2" showing the wrong players.

**Needs a decision, not just a migration**: adding a real `pairing_table_number` column touches every read site that currently computes it from index (`PairingsCard.vue`, `TableCardActions`, `PairingTableActions`, `ConfirmModal` subjects in the reset/fill dialogs, `PairingsFullscreenView.vue`, and the pairing-generation code in `shared/utils/roundScoring.ts`'s `buildPairingRows`/`buildRoundOneTables` that would need to actually set it). Before implementing: audit **all** of these together (the user asked specifically to review how this fits with everything else) rather than adding the column and fixing sites piecemeal — a half-migrated state (some reads using the new column, others still on array index) would be worse than the current fully-consistent-but-implicit convention.

**P3/someday**, deferred behind the event lifecycle priority same as #7/#8/#10 — the current behavior is verified correct, this is a robustness improvement, not a live bug.

---

## 15. `table_wins` stat persistence (booster pack reward per round)

Raised 2026-07-14, promoted from `docs/TODO.md` 2026-07-21 (was tracked in two places there — the "Booster pack reward per round" note and event-lifecycle-audit item #9 — merged into this single entry).

After **every** round (including the last one), the winner of each table receives a booster pack.

- ~~**In-room checklist**~~ — **done** (2026-07-21): `WinnerChecklist.vue` + `useWinnerChecklist.ts`, winners derived live from `rankingsStore`, check-off state persisted per event+round in `localStorage`. See ADR-019 in `docs/PROGRESS.md`.
- **Stat persistence** (still open): record it on player stats as "table wins". Verify what already exists before adding anything: `standings.victories` already accumulates `position === 1` per event, and `player_stats` is trigger-computed from `round_results` — a table win is derivable as `round_results.position = 1`, so this may need **zero new columns**, just a `table_wins` aggregate in the `player_stats` trigger (or even a query).

---

## Historical notes

- **Reinventing-the-wheel audit (2026-05-27):** recorded here only so the "9 of 11 fixed" count in `docs/PROGRESS.md`'s 2026-07-13 changelog entry is traceable. Fixed: `toErrorMessage()` extraction, `useEventUrl.ts`'s generic `setQueryParam`, `app/utils/math.ts`'s `roundToDecimals`/`isCloseTo`, `sanitizePlayer()` consistency, `upperFirst.ts` removed. Went moot: the Scryfall card-search composables it flagged (`useCardWhitelists`/`useCardSearch`) no longer exist — that feature was migrated to Supabase-backed data instead of patched in place.
- **`docs/bugs.md`'s table-preview-optimization bug (2026-07-13):** the report was "clicking Conferma runs table optimization and then closes the modal, but optimization should happen before the modal is shown." Checked against current code — `TablePreviewModal.vue`'s `watch(open, ...)` (lines 102-120) already auto-runs the optimizer as soon as the modal opens (gated on `loading`, guarded by `hasAutoOptimized`), and `playerOrder` is propagated through `handleConfirm` → `emit('confirm', playerOrder.value)` → `useEventLifecycle.ts`'s `nextRound(playerOrder)` — matching the fix already logged in `PROGRESS.md`'s 2026-05-26 changelog entry ("Preview mostra tavoli prima di avanzare round"). Not carried forward as a live bug.
