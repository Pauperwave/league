# Todos

Loose observations and open questions — not yet committed, ranked work. For that, see `docs/BACKLOG.md`.

## Event lifecycle UX/bug audit (2026-07-20)

Raised in one batch after walking the full event lifecycle end-to-end. Numbered so each can be tackled and checked off one at a time — don't try to do all of these in one pass. Three of these (#8, #11, #12) turned out to be real data-integrity/state bugs, not just UX polish; #11 in particular overlaps `docs/BACKLOG.md`'s #12 (idempotency guards) and should probably be fixed together with it.

### 0. Network call audit + icon bundling report

**Icon bundling (`scan: true` not working) — root cause confirmed.** `nuxt.config.ts:90-97` sets `icon: { clientBundle: { scan: true } }`, which is the correct option path for the installed `@nuxt/icon@2.3.1`. The problem is the scanner's default `globInclude` (`["**/*.{vue,jsx,tsx,md,mdc,mdx,yml,yaml}"]`) doesn't include `.ts` — and all ~120 icon names live as string literals in `app/utils/icons.ts` (a plain `.ts` file), referenced dynamically as `:icon="ICONS.foo"` in templates, never as a literal `i-lucide-*` string inside a `.vue` file. The scanner never sees them, so none get bundled — each is fetched at runtime via `/api/_nuxt_icon/*.json`, matching what was observed in network requests. Fix: add `ts` to `globInclude`:
```ts
icon: {
  clientBundle: {
    scan: { globInclude: ['**/*.{vue,jsx,tsx,md,mdc,mdx,yml,yaml,ts}'] }
  }
}
```
120 icons is small enough that bundling all of them isn't a size concern.

**Standings repeatedly called, returns `[]` — root cause confirmed (see also #3 below).** `useEventPage.ts:33` calls `useEventStandingsQuery(eventId)` unconditionally on mount with no `enabled` gate, unlike `usePairingsQuery` (`useEventQueries.ts:130`, `enabled: () => toValue(round) > 0`) which deliberately skips fetching during registration. `standings` rows are only created server-side when `startEvent` runs (`events.ts:50`) — during `registration` there are zero rows for that `event_id` by design, so `[]` is the *correct* DB answer, just fetched too early. "Repeatedly": Pinia Colada's default `staleTime` is 5000ms and nothing in the project overrides it, so every remount/re-evaluation while the event page sits in registration re-fires the query and gets `[]` again.

**Other network-call findings:**
- `useEventsQuery`/`useMultipleEventStandingsQuery`/`useLeagueStandingsQuery` are properly keyed and share Colada's cache (`EventRanking.vue:13,26` reuses the same `['events', leagueId]` key as `useEventPage.ts:32`) — no duplication found.
- `refreshAfterLifecycle()` (`useEventPage.ts:136-144`) fires 5 refetch/invalidate calls after every lifecycle transition (start/next/turn-back) — appropriate, each cache genuinely changes.
- Every `save*` action in `events.ts` (rankings/kills/commander/votes, lines 159-208) is a raw `$fetch` with no Colada cache invalidation tied to it — standings/pairings caches only refresh on the next *lifecycle* transition, not after each individual score/kill/commander/vote save. Not confirmed as a bug, but worth checking whether any UI reads standings mid-round expecting it to reflect a just-submitted result.

### 1. Confirm modal before removing a player from the waiting list

`WaitingListTable.vue:167` (`onDelete: () => emit('remove', row.original.playerId)`) and `WaitingList.vue:80` (`@remove="emit('remove', $event)"`) both go straight to `removeFromWaitingList([playerId])` (`[leagueId]/event/[eventId].vue:438`) with no confirmation. Wrap it with `ConfirmModal`, same pattern as `PairingsCard.vue`'s table-reset confirm.

### 2. `CreatePlayerModal`: "Crea Giocatore" is blocked by similar-player matches even when they're not the same person

`CreatePlayerModal.vue:67-73` — `canCreate` returns `false` whenever `hasSimilarPlayers` is true in creation mode, with no way to proceed anyway. The similarity warning card (lines 179-223) already has a "Seleziona" action per match to link the *existing* player, but there's no "no, create a new one anyway" escape hatch — the user is stuck. Fix: let `canCreate` stay `true` when similar players are found (keep the warning visible, just don't gate submission on it), or add an explicit "crea comunque" acknowledgment.

### 3. `CreatePlayerModal` "Annulla" should return to the "Aggiungi giocatori alla lista d'attesa" modal, not close everything

`useEventPlayers.ts:35-38` (`handleCreateNewPlayer`) opens `showCreatePlayerModal` but never closes `showPlayerSearchModal` — and `useFormModalMeta`'s `handleCancel` (wired at `CreatePlayerModal.vue:137`) only closes the create-player modal, with no notion of "came from search." Fix needs a way for the cancel path to know it was opened via `PlayerSearchModal`'s `@create-new` (`[eventId].vue:449`) and reopen `showPlayerSearchModal` instead of just closing — e.g. a dedicated cancel handler in `useEventPlayers.ts` rather than routing through the generic `useFormModalMeta` cancel.

### 4. "Pesi e Vincoli Pairing" formula is missing the 4-player-table bonus term

Not actually a missing weight — a labeling gap. The formula string is hardcoded at `i18n/locales/it.json:551` (`"totale = bilanciamento_forza + novità - rematch - rotazione3 + peso_dimensione"`), rendered verbatim at `PairingWeightsSection.vue:56`. `peso_dimensione` silently stands in for **two** independently-adjustable weights defined in `pairingOptimizer.ts:63-70`: `tableSize4` (default 0.15, labeled "Bonus tavoli da 4" at `it.json:584`) and `tableSize3` (default -0.15, "Peso tavoli da 3" at `it.json:585`), applied at `pairingOptimizer.ts:347`. Both sliders already exist individually in the modal; only the summary formula collapses them. Fix: `totale = bilanciamento_forza + novità - rematch - rotazione3 + bonus_tavoli4 + peso_tavoli3`.

### 5. "Coppie Vietate" / "Pesi dell'algoritmo" — are they persisted, and carried into later rounds?

Both persist to **`localStorage`**, not the DB: `app/composables/event-pairing/pairingPreferences.ts:10-11,32-71`, keyed `pairing-preferences-event-${eventId}` (per-event, not per-round) — `it.json:561` already discloses this to the user in-modal. Since the key is event-scoped, values *do* carry forward automatically across rounds within the same event, but they're browser/device-local: a different browser, incognito session, or cleared storage silently loses them. No DB table backs this (no `event_pairing_weights`-style migration exists). Worth a decision on whether this should move server-side — flagged here, not fixed.

### 6. "Pesi e Vincoli Pairing" modal has no footer (no "Conferma"/"Annulla")

Confirmed — `PairingSettingsModal.vue:41-70` only fills `UModal`'s `#body` slot. This turns out to be intentional-by-omission rather than a bug: there's no local draft state to confirm/discard — every slider drag and pair add/remove (`updateWeight`/`addPair`/`removePair`, lines 34-37) applies live and writes straight to `localStorage` via #5. If a footer is still wanted for symmetry with other modals, it should probably be a single "Chiudi" button (nothing to actually confirm or cancel), not `ModalFooterActions`'s Conferma/Annulla pair — check `ModalFooterActions`' API before reusing it here since its Conferma/Annulla framing doesn't fit a live-apply modal.

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

### 9. New component: always-present "who's won this table" checklist, filled in as scores are entered

This is the same feature already tracked as the second half of the existing **"Booster pack reward per round"** TODO item above — see that entry for the fuller spec (booster hand-out tracking + `table_wins` stat). Keep them merged rather than tracked twice; when picked up, scope it as: a persistent per-round panel/component listing each table's rank-1 player, populated live as `hasRanking` flips true per pairing (same signal `PairingTableActions.vue:25` already reads).

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

## Waiting list paid/companion flags: persist to localStorage (2026-07-14)

The paid/companion checkboxes in `WaitingListTable` are deliberately ephemeral ("just for remembering right in that moment" — confirmed 2026-07-14, NOT a bug); they currently vanish on page refresh, though. Persist them to **localStorage** (not the DB), keyed by event — same pattern as `useSessionStorePersistence`/`RoundTimer`: hydrate on mount, write through on change, clear when the event starts (waitroom is cleared then anyway).

## Booster pack reward per round: winner checklist + "table wins" stat (2026-07-14)

After **every** round (including the last one), the winner of each table receives a booster pack. Two parts:
- **In-room checklist**: a "boosters to hand out" todo list per round — generated from the round's table winners (rank 1 per pairing), with a check-off state so the organizer knows who has already received theirs. Probably an event-page panel or modal shown after round scores are confirmed.
- **Stat persistence**: record it on player stats as "table wins". Verify what already exists before adding anything: `standings.victories` already accumulates `position === 1` per event, and `player_stats` is trigger-computed from `round_results` — a table win is derivable as `round_results.position = 1`, so this may need **zero new columns**, just a `table_wins` aggregate in the `player_stats` trigger (or even a query). The checklist's check-off state, if it must survive refresh, can live in localStorage like the round timer.

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
