# Test Coverage Reference

<!-- docs/architecture/testing.md -->

What's actually tested today, area by area — and just as importantly, what isn't. Companion to `api.md` (CRUD reference) and `component-hierarchy.md` (component catalog): this doc answers "is X covered, and by what kind of test," not "does X exist" or "what can X do."

Three test layers exist: **unit** (`test/unit/`, pure logic, `happy-dom` environment, no Nuxt runtime), **component** (`test/nuxt/`, mounts real components with an auto-import mirror — see `app/composables/CLAUDE.md`), and **E2E** (`test/e2e/`, Playwright against the real production build and Supabase project — see `architecture/api.md`'s sibling note and `BACKLOG.md` #1). Run them via `pnpm test` / `pnpm test:unit` / `pnpm test:nuxt` / `pnpm test:e2e`.

## At a glance

| Area | Unit | Component | E2E |
|------|:----:|:---------:|:---:|
| Pure utils (`math`, `time`, `cardColors`, `standingsSubmission`) | 🟩 | – | – |
| Pure utils (`error`, `logger`, `localStorage`, `slug`, `icons`, `actionButton`) | 🟥 | – | – |
| Pairing/ranking/standings logic (`pairingOptimizer`, `useLiveStandings`, `useRankingGrid`, `useTableDnd`, `usePlayersFilter`) | 🟩 | – | – |
| Session persistence (`useSessionStorePersistence`) | 🟩 | – | – |
| Colada query/mutation composables (leagues, rulesets, players, decks, events, commanders) | 🟥 | – | 🟨 (leagues, players create, decks create) |
| Event orchestration composables (lifecycle, page, modals, submit handlers, URL sync, waitroom) | 🟥 | – | 🟨 (leagues only, not events) |
| Pinia stores (`events.ts` lifecycle + 4 session stores) | 🟥 | – | 🟨 (indirect, via UI only) |
| Small leaf components (`CurrentTime`, `RowActionButton`) | – | 🟨 | – |
| `StandingsCard` | – | 🟨 | – |
| Event page shell, modals, pairing UI, waiting-room, ruleset components | – | 🟥 | 🟥 |
| Player/deck components | – | 🟥 | 🟨 (create only) |
| Server API endpoints (23 total) | 🟥 | – | 🟨 (5 of 23, via the league/player/deck E2E specs) |
| League CRUD (create/edit/delete via real UI) | – | – | 🟩 |
| Player create, deck create (via real UI) | – | – | 🟨 (create only, no edit/delete UI coverage) |
| Event CRUD, lifecycle (start/advance-round/turn-back-round), round-result submission | – | – | 🟥 |

**Legend**
- 🟩 well covered — multiple cases, edge cases considered
- 🟨 partial — at least one real test exists, but shallow (single case) or only exercised indirectly as a side effect of testing something else
- 🟥 zero coverage
- `–` this test layer doesn't apply to this area (e.g. E2E-testing a pure math function is pointless; component-testing a plain utility function isn't a thing)

## Unit tests (`test/unit/`) — 10 files, all pure logic

| File | What's covered |
|------|-----------------|
| `utils/math.test.ts` | `roundToDecimals`, `isCloseTo` — minimal, 4 assertions total |
| `utils/time.test.ts` | `formatDuration` — 0s, sub-minute, exact hour, hour+min+sec |
| `utils/cardColors.test.ts` | Mana-cost color extraction (multi-color, Phyrexian, colorless), `resolveCardColors` (double-faced merge, color-identity fallback), `buildGradientClass` (1–4+ colors, unknown letter) |
| `utils/standingsSubmission.test.ts` | `buildStandingsSubmissionMap` — submitted vs not-all-ranked cases |
| `composables/event/useLiveStandings.test.ts` | `buildPosValues`, `cloneStandings`, `calculatePlayerTableScore` (tied ranks, kills, brew/play votes, zero-score), `updateStanding` (victory only on rank 1) |
| `composables/event/useSessionStorePersistence.test.ts` | Hydrate-on-round-match, skip-on-mismatch, persist-on-mutation, Map/Set round-trip, reset-on-round-advance |
| `composables/event-pairing/pairingOptimizer.test.ts` | No duplicate players, forbidden-pair respect, 3/4-table splits for 10 players, per-player score sums to table total |
| `composables/players/usePlayersFilter.test.ts` | Sort (name/surname tie-break, deck count, stat field), search, "only with decks", all 4 empty-state variants |
| `composables/tables/useRankingGrid.test.ts` | 3 vs 4 player sizing, save/restore ranking, tie validity, rank-gap rejection, cross-column drop rejection |
| `composables/tables/useTableDnd.test.ts` | `conflictingTables`, `previewError` messages, `replaceByPlayerOrder` |

**Gap**: every composable that talks to Supabase or a BFF endpoint has zero unit tests — nothing in `commanders/`, `deck/`, `league/`, `ruleset/`, most of `players/`, `supabase/useStatsQueryBuilder`, `theme/`, `ui/useBreadcrumb|useButtonLogging|useFormModalMeta`, `tables/useTableCalculator|useTableUtils`, and nearly all of `event/` except the two files above (`useEventLifecycle`, `useEventMutations`, `useEventPage`, `useEventPlayers`, `useEventQueries`, `useEventSubmitHandlers`, `useEventUrl(Sync)`, `useWaitroom`, `usePairingPresets`, `event-pairing/pairingPreferences`). None of the 5 Pinia stores (`events.ts` + 4 session stores) have a dedicated test file — `useSessionStorePersistence.test.ts` only exercises them via hand-built fakes matching their shape, not their real mutation/getter logic.

## Component tests (`test/nuxt/`) — 3 files, all shallow

| File | What's covered |
|------|-----------------|
| `components/event/CurrentTime.test.ts` | Renders HH:mm, ticks forward on timer advance, clock icon present |
| `components/event/standings/StandingsCard.test.ts` | Single case: title + "submitted" badge render when `submittedByPlayerId` is set |
| `components/ui/actions/RowActionButton.test.ts` | "remove" action → correct color/aria-label; `loading`/`disabled` propagation |

**Gap**: this is the thinnest layer by far. Zero component tests for the entire event page shell (`EventControlPanel`, `EventStepper`, `RoundTimer`, `TimerControlButton`, `EndedEventBadge`), every event modal (score/kill/commander/votes/next-round/form), the whole pairing UI (`PairingsCard`, `PairingSettingsModal`, weights/presets/forbidden-pairs sections, kill-flow canvas, all table card/seat/score-grid components, preview grid/toolbar), waiting-room components, and every deck/league/ruleset/player form modal and display component.

## E2E tests (`test/e2e/`) — 3 specs

| File | What's covered |
|------|-----------------|
| `league-crud.e2e.spec.ts` | Create → edit (rename) → delete a league via the real UI against production, asserting on actual `/api/leagues/*` network responses and table rows |
| `player-create.e2e.spec.ts` | Create a player via the real UI (`/players`), asserting on `/api/players/create` and the resulting card grid text. No update/delete coverage — `/players` has no edit action and there is no delete endpoint (see `api.md`) |
| `deck-create.e2e.spec.ts` | Create a deck for an existing player via the real UI (`/player/[slug]`), asserting on `/api/decks/create` and the resulting deck card's "Statistiche" link (built from the commander-name slug — the commander is a fake tag with no Scryfall art, so no `<img>`/alt-text or visible name heading renders, per `ImageWithFallback.vue`/`CommanderArt.vue`). No update/delete UI coverage yet — see `BACKLOG.md` #1 |

**Gap**: event creation, the event lifecycle (start → advance-round → turn-back-round), round-result submission (rankings/kills/commander/votes modals), waitroom registration, rulesets, and deck/player edit+delete all remain untested end-to-end. See `BACKLOG.md` #1 for the planned next specs.

## Where to look before adding a new test

- **Pure function, no Nuxt/Supabase dependency** → `test/unit/`, mirrors the source path (`app/utils/x.ts` → `test/unit/utils/x.test.ts`).
- **Component that needs Nuxt auto-imports/mount** → `test/nuxt/`, same mirrored path convention.
- **Full user-facing flow through the real app** → `test/e2e/`, tagged disposable data + guaranteed cleanup (see `helpers/testTag.ts`/`helpers/cleanup.ts`) — this suite runs against production, never assert against or mutate pre-existing rows.
- Check the tables above first — a near-identical case (e.g. another sort composable, another form modal) likely already has a template to copy rather than inventing a new test pattern.
