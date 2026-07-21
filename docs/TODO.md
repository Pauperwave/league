# Todos

Loose observations and open questions — not yet committed, ranked work. For that, see `docs/BACKLOG.md`.

## Upgrade Nuxt to 4.5 and Nuxt UI to 4.10 (2026-07-21)

Currently on `nuxt@^4.4.8` / `@nuxt/ui@^4.9.0`. Do this as its own isolated pass (`pnpm typecheck` + `pnpm lint` clean, then a manual smoke pass through the event lifecycle) rather than folding it into an unrelated feature change — Nuxt UI has broken component APIs across minor versions before. Check `@nuxt/ui`'s peer `typescript` range hasn't moved past `^5.9.x` before bumping (see root `CLAUDE.md`'s note on staying off TypeScript 6.x/7.0 for now).

## 🔴 HIGH PRIORITY — Bug: can't move a player from one table to another in the pairing preview (2026-07-21)

User-reported, confirmed still broken as of this session (not yet root-caused/fixed). Drag-and-drop between tables lives in `TableCard.vue` (`VueDraggable`, `:group="{ name: 'seats', pull: true, put: true }"`, shared `group.name` across every `TableCard` instance so cross-table drops should work in principle) inside `TablePreviewGrid.vue`/`TablePreviewModal.vue`, with `useTableDnd.ts` (`app/composables/tables/useTableDnd.ts`) holding the `localTables` state that each `TableCard`'s `seatsModel` reads/writes via `updateSeats`.

One concrete lead spotted while reading `TableCard.vue`, not yet confirmed as *the* cause: `visibleSeats` (line 34-37) filters a full (4/4) table down to **only its occupied seats** when rendering the draggable list:
```ts
const visibleSeats = computed(() => {
  const occupiedCount = props.table.seats.filter(seat => seat.player !== null).length
  return occupiedCount >= 4 ? props.table.seats.filter(seat => seat.player !== null) : props.table.seats
})
```
For a table that already has 4 players, this removes any empty-seat drop target from the DOM entirely — `VueDraggable`'s `put`/cross-list dragging generally needs *some* element (even an empty slot) to drop onto/into. If the source table is dragging a player OUT (making room) this shouldn't matter, but if the *target* table is full, there may be nowhere in the DOM to drop onto. Needs to actually be tested against a live repro (drag from a non-full table into a full one vs. non-full-to-non-full vs. full-to-non-full) to confirm which direction(s) fail before touching this.

Next step: reproduce with the dev server + browser tools (not done yet this session — Chrome extension wasn't connected) to pin down exactly which drag direction/table-occupancy combination fails, then fix in `TableCard.vue`/`useTableDnd.ts`.

## Event lifecycle UX/bug audit (2026-07-20)

Raised in one batch after walking the full event lifecycle end-to-end. Numbered so each can be tackled and checked off one at a time — don't try to do all of these in one pass. Three of these (#8, #11, #12) turned out to be real data-integrity/state bugs, not just UX polish; #11 in particular overlaps `docs/BACKLOG.md`'s #12 (idempotency guards) and should probably be fixed together with it.

### 0. ~~Network call audit + icon bundling report~~ — icon bundling resolved 2026-07-21

Fixed: `nuxt.config.ts`'s `icon.clientBundle.scan.globInclude` now includes `ts` (was missing it — the scanner's default `globInclude` doesn't cover `.ts`, and all ~120 icon names live as string literals in `app/utils/icons.ts`, referenced dynamically as `:icon="ICONS.foo"`, never as a literal `i-lucide-*` string inside a `.vue` file — so the scanner saw zero icons and every one was fetched at runtime via `/api/_nuxt_icon/*.json` instead of being statically bundled). Confirmed via `pnpm typecheck`'s own Nuxt Icon output going from reporting nothing to "90 icons, 25.25KB" bundled.

Root-caused this way after observing `EventStepper.vue` render the wrong/missing icon for a duplicate dynamically-fetched icon ("swords", used by every round step) — reproducible in the Nuxt dev server, but **confirmed NOT present in deployed prod** (checked against `v0.20.2`, which predates this fix and never had the bug either) — so this was a dev-only icon-fetch race, not a real user-facing bug. Bundling statically is still the right call: it removes the fetch race structurally instead of relying on prod happening to avoid it.

Network call audit findings below are unrelated and still open.

**Standings repeatedly called, returns `[]` — root cause confirmed (see also #3 below).** `useEventPage.ts:33` calls `useEventStandingsQuery(eventId)` unconditionally on mount with no `enabled` gate, unlike `usePairingsQuery` (`useEventQueries.ts:130`, `enabled: () => toValue(round) > 0`) which deliberately skips fetching during registration. `standings` rows are only created server-side when `startEvent` runs (`events.ts:50`) — during `registration` there are zero rows for that `event_id` by design, so `[]` is the *correct* DB answer, just fetched too early. "Repeatedly": Pinia Colada's default `staleTime` is 5000ms and nothing in the project overrides it, so every remount/re-evaluation while the event page sits in registration re-fires the query and gets `[]` again.

**Other network-call findings:**
- `useEventsQuery`/`useMultipleEventStandingsQuery`/`useLeagueStandingsQuery` are properly keyed and share Colada's cache (`EventRanking.vue:13,26` reuses the same `['events', leagueId]` key as `useEventPage.ts:32`) — no duplication found.
- `refreshAfterLifecycle()` (`useEventPage.ts:136-144`) fires 5 refetch/invalidate calls after every lifecycle transition (start/next/turn-back) — appropriate, each cache genuinely changes.
- Every `save*` action in `events.ts` (rankings/kills/commander/votes, lines 159-208) is a raw `$fetch` with no Colada cache invalidation tied to it — standings/pairings caches only refresh on the next *lifecycle* transition, not after each individual score/kill/commander/vote save. Not confirmed as a bug, but worth checking whether any UI reads standings mid-round expecting it to reflect a just-submitted result.

### 1. ~~Confirm modal before removing a player from the waiting list~~ — resolved 2026-07-20

Fixed: `WaitingListTable.vue`'s row-delete action now opens a `ConfirmModal` (same pattern as `PairingsCard.vue`'s table-reset confirm) before emitting `remove`, instead of calling `removeFromWaitingList` straight away. `batchRemove` (the multi-select toolbar button) was left as-is — out of this item's original scope, but worth the same treatment if it comes up again.

### 2. ~~`CreatePlayerModal`: "Crea Giocatore" is blocked by similar-player matches even when they're not the same person~~ — resolved 2026-07-20

Fixed: removed the `canCreate` gate entirely (it only ever differed from plain form validity by also requiring `!hasSimilarPlayers`) — the submit button is now disabled purely on `isValid`. The warning card and its "Seleziona" action are unchanged, and its help text now also tells the user they can just proceed with creation if it's not the same person.

### 3. ~~`CreatePlayerModal` "Annulla" should return to the "Aggiungi giocatori alla lista d'attesa" modal, not close everything~~ — resolved 2026-07-20

Fixed in `useEventPlayers.ts`: a local `openedFromSearch` ref is set in `handleCreateNewPlayer` (the only path reachable from `PlayerSearchModal`'s `@create-new`) and cleared by `handleEditPlayer` and by every success path (`handlePlayerCreate`/`handlePlayerSelectFromModal`). A `watch(showCreatePlayerModal, ...)` reopens `showPlayerSearchModal` whenever the create modal closes while that flag is still set — which only remains true for a genuine cancel (Annulla, backdrop, ESC, or X), since every success path clears it first. `CreatePlayerModal.vue` itself needed no changes; its existing `handleCancel` already just closes its own `open` v-model, which is all the watcher needs to react to.

### 4. ~~"Pesi e Vincoli Pairing" formula is missing the 4-player-table bonus term~~ — resolved 2026-07-20

Fixed: `i18n/locales/it.json`'s `pairingWeights.formula` now spells out both terms individually (`totale = bilanciamento_forza + novità - rematch - rotazione3 + bonus_tavoli4 + peso_tavoli3`) instead of collapsing them into one `peso_dimensione` placeholder. No logic changed — the two weights were already computed correctly, this was a display-only string.

### 5. "Coppie Vietate" / "Pesi dell'algoritmo" — are they persisted, and carried into later rounds?

Both persist to **`localStorage`**, not the DB: `app/composables/event-pairing/pairingPreferences.ts:10-11,32-71`, keyed `pairing-preferences-event-${eventId}` (per-event, not per-round) — `it.json:561` already discloses this to the user in-modal. Since the key is event-scoped, values *do* carry forward automatically across rounds within the same event, but they're browser/device-local: a different browser, incognito session, or cleared storage silently loses them. No DB table backs this (no `event_pairing_weights`-style migration exists). Worth a decision on whether this should move server-side — flagged here, not fixed.

### 6. ~~"Pesi e Vincoli Pairing" modal has no footer (no "Conferma"/"Annulla")~~ — resolved 2026-07-20

Added a footer with a single "Chiudi" button (`CancelButton` + `common.close`), not `ModalFooterActions`' Conferma/Annulla pair — correctly matches this modal's shape, since every edit here still applies live to `localStorage`, there's nothing to actually confirm or discard.

### 7. Button color semantics: "Classifica"/"Uccisioni"/"Inserisci Commander"/"Inserisci voto" should be neutral-when-empty, success-when-filled (not warning-when-empty)

Confirmed inconsistent today across three components, all using `warning` for the empty state:
- `PairingTableActions.vue:25` (ranking): `hasRanking ? 'neutral' : 'warning'`
- `PairingTableActions.vue:38` (kills): `killsConfirmed ? 'neutral' : 'warning'`
- `PairingTableActions.vue:54` (kill-confirm toggle): `killsConfirmed ? 'success' : 'warning'`
- `TableSeatItem.vue:75` (commander): `hasCommander ? 'success' : 'warning'`
- `PairingPlayerRow.vue:36` (commander, different component): `hasCommander ? 'neutral' : 'warning'`
- `PairingPlayerRow.vue:52` (vote): `hasVotes ? 'neutral' : 'warning'`

Two different color schemes already coexist for the *same* concept (commander) depending on which component renders it. Fix: standardize all six on `filled ? 'success' : 'neutral'`.

### 8. ~~Bug: "Uccisioni" (kills) not stored when the kill modal is closed~~ — resolved 2026-07-20

Fixed by saving the whole kill list once whenever the modal closes (any way — button, backdrop, ESC, X), instead of gating persistence behind an explicit "Conferma" the UI never made clear was required. See `docs/PROGRESS.md`'s 2026-07-20 entry for the full fix (also added a `round_kills` table to persist actual killer→victim pairs, not just the aggregate count).

### 9. ~~New component: always-present "who's won this table" checklist, filled in as scores are entered~~ — promoted to `BACKLOG.md` #15 (2026-07-21)

Merged with the "Booster pack reward per round" note below into a single actionable backlog item.

### 10. "Termina evento" button shouldn't be `success`-colored

`EventControlPanel.vue:89` — the advance-round *and* end-event actions share one button whose color is purely `props.canAdvance ? 'success' : 'neutral'` (text changes via `isLastRound` at line 93, color doesn't). Ending the event is a bigger, less-reversible action than advancing a round; consider splitting the color logic so the last-round case renders `warning` instead of `success` regardless of `canAdvance`.

### 11. Bug: final standings wrong after "Termina evento" — round scores double-counted via turn-back-round

Confirmed real data bug, not a staleness/cache issue (ruled out: `refreshAfterLifecycle()` in `useEventPage.ts:136-144` does refetch standings correctly after every transition — the data shown is fresh, just wrong at the source). Root cause:
- `advance-round.post.ts:65-81` scores the *closing* round by **adding** its contribution onto the persisted `standings` row (`shared/utils/roundScoring.ts:88-142` `calculateRoundScores`, `+=` semantics; `:145-175` `updateStandingsAndRanks` writes it back). "Termina evento" is the same code path (`useEventLifecycle.ts:63-67` → `nextRound()` with `hasEnded=true`).
- `turn-back-round.post.ts:33-100` (round > 1 branch) reopens the previous round by decrementing `event_current_round` and deleting only that round's `pairings`/`round_results` — it never reverses the score already added to `standings` for the round being reopened.
- Net effect: turn back a round, then re-advance/re-end (even without changing anything) — `calculateRoundScores` re-fetches and **re-adds** that round's score on top of what's already in `standings`. That round's points get counted twice, inflating the final totals.

**This overlaps `docs/BACKLOG.md` #12 (idempotency guards)** — fixing both together makes sense: the real fix is probably making standings a derived `SUM` over per-round scores rather than a stateful `+=`, which would close this bug and remove most of the idempotency risk in #12's `advance-round`/`start` bullet points at once. Touches `turn-back-round.post.ts`'s round>1 branch at minimum.

### 12. Bug: going back to a previous round breaks navigation state — only the UStepper should control "viewing last round results"

Confirmed root cause: a missing reset, not a rendering bug. `useEventPage.ts:202-217` — `viewedRound` is set by `viewRound(round)` (stepper's `@view-round`) and cleared only by `clearViewedRound()`, which is wired to exactly one place: a manual "torna al round corrente" button (`[eventId].vue:417`). None of `nextRound()`, `turnBackRound()`, or `confirmCancelRound()` (`useEventLifecycle.ts:63-100`) ever call it. `displayedPairingsData` (`useEventPage.ts:210`) is keyed on `viewedRound.value ?? currentRound.value` — so if the organizer was viewing a past round and then turns back a round, `currentRound` moves server-side but `viewedRound` stays stuck, and since turn-back-round deletes that round's pairings, the page can end up querying a round number that no longer means what it used to — silently, no error surfaced. Fix: call `clearViewedRound()` from inside `confirmCancelRound`/`confirmNextRound`/`confirmEndEvent` (or `resetSessionStores()`) in `useEventLifecycle.ts`, so every lifecycle transition forces the view back to "current round" and only an explicit stepper click can leave it again.

---

## Deck stats pages: refactor + charts (2026-07-21)

Both `/player/[slug]/deck/[deckSlug]` (`app/pages/player/[slug]/deck/[deckSlug].vue`) and the global commander page `/deck/[deckSlug]` (`app/pages/deck/[deckSlug].vue`, the one the user calls "commanders") currently render the same flat shape: `DeckHeader` + `CommanderArtGallery` + one `DeckStatsRow` of point-in-time numbers (events/matches/wins/kills/average). No history, no trend — just the current aggregate from `deck_stats`/`commander_stats`.

- **Refactoring angle**: the two pages are near-duplicates of each other already (same `DeckHeader`/`CommanderArtGallery`/`DeckStatsRow` composition, same `useCommanderCards` + `useDeckDisplay` calls) — the difference is really just the data source (`useDeckStats` scoped to one player vs. `useCommanderStats` aggregated across all players) and the global page's extra "players using this deck" list. Worth checking whether a shared page-body component (taking the stats/art/loading as props) would remove the duplication cleanly, or whether it's coincidental enough to leave alone (same judgment call as `LeagueTable.vue`/`EventTable.vue`'s `statusConfig`, see below).
- **Graphs**: both pages only have access to already-aggregated totals (`deck_stats`/`commander_stats`), not a time series — there's no per-round or per-event history table to chart from. Charting a trend (e.g. average score over time, win rate by event) would need either a new query over `round_results` grouped by event/date, or a new denormalized table/view built for that purpose. Needs a charting library decision too — nothing is installed yet (checked `package.json`, no `chart.js`/`apexcharts`/`unovis`/etc.).

Flagged by the user for both pages together — not yet scoped into concrete BACKLOG items.

## ~~Waiting list paid/companion flags: persist to localStorage~~ — resolved 2026-07-21

Fixed: `useWaitingListFlags.ts` persists `paid`/`companion` per player to localStorage (via `getCached`/`setCached`), keyed per event, cleared on event start (`useEventLifecycle.ts`'s `handlePreviewConfirm`). Deliberately reads in `onMounted` rather than synchronously — a synchronous read caused an SSR hydration mismatch (Nuxt UI's checkbox didn't reliably repaint the real value until an unrelated click forced a re-render).

## Booster pack reward per round: winner checklist + "table wins" stat — promoted to `BACKLOG.md` #15 (2026-07-21)

## Deletion UX: 10-second undo + soft delete (2026-07-14)

For destructive actions (delete player/deck/league/event/waiting-list entry): show a 10-second undo toast instead of deleting immediately, and back it with **soft delete** on Supabase (`deleted_at timestamptz` column + filtered SELECTs, or a `deleted` flag) so the undo window is honest (restore = clear the flag) and accidental deletions stay recoverable beyond the toast. Needs: schema migration per table, store delete actions rewritten to soft-delete + delayed hard-confirm (or just soft-delete forever + periodic purge), `useToast` action button wiring.

## Component granularity audit (2026-07-14)

Reviewed all of `app/components/` (largest files, `fallow:health`, usage grep) while writing `app/components/CLAUDE.md`. Overall verdict: healthy — no component is a complexity hotspot, and the biggest ones (`TablePreviewModal`, `PairingsCard`) already delegate their logic to composables/subcomponents. Remaining observations:

**Intentionally unreferenced (do NOT delete):**
- ~~`event/EndedEventBadge.vue`~~ — resolved 2026-07-14: now rendered in the event page's ended phase, above the final `StandingsCard`.

**Merge candidates (over-decomposed):**
- ~~`layout/HeaderActions.vue`~~ — flagged as a logic-free wrapper inlinable into `app.vue`; decided 2026-07-14 to **keep it as-is** (preferred for readability of `app.vue`). Closed.
- Borderline, fine as-is: `layout/AppLogo.vue` (9 lines, single use, but the light/dark invert trick is worth the name) and `player/PlayersHeader.vue` (23 lines, single use, but it carries breadcrumb logic).

**Decomposition candidates:**
- ~~`event/pairing/table/score/TableScoreGrid.vue`~~ — done 2026-07-14: grid state (init, drag handlers, formation validation, rank extraction) extracted to `useRankingGrid` (`app/composables/tables/useRankingGrid.ts`) with unit tests. The `[VALID FORMATION]` console.logs are intentional debug output while the app is under test — keep them.
- `event/waiting/WaitingListTable.vue` (277 lines) — cohesive (one table + selection + batch actions); the batch-actions toolbar is the natural first cut if it grows.

**Convention drift spotted in passing:**
- ~~`event/CurrentTime.vue` auto-import reliance~~ — resolved 2026-07-14 by **inverting the convention**: `vitest.config.ts` now mirrors Nuxt's auto-imports (`unplugin-auto-import`), so source files rely on auto-imports everywhere and no sweep toward explicit imports is needed. The redundant explicit value imports that had accumulated were swept out instead. See root `CLAUDE.md`.

## Parametrization opportunities found during the i18n migration
Not urgent, just flagged while migrating strings on 2026-07-13:
- **Status→color/icon config duplicated per table.** `LeagueTable.vue`'s `statusConfig` and `EventTable.vue`'s equivalent both hardcode their own `Record<string, { color, icon, labelKey }>` mapping a stable status value to a badge color/icon/i18n key. Same shape, two copies. As of 2026-07-13, deliberately left unabstracted and formally suppressed via `// fallow-ignore-file code-duplication` in both files (see `app/components/ui/CLAUDE.md`) rather than left as silent noise in `fallow:dupes` output — still worth a shared composable (e.g. `useStatusBadge()`) if a third status-bearing entity shows up.
- **Date/number formatting isn't locale-aware.** `formatDate` and friends use hardcoded formatting rather than deriving from the active `vue-i18n` locale. Harmless while `it` is the only locale, but would need revisiting the moment a second locale is added.
