# Plan: Developer mode action log panel

## Context

Developer mode (`useDeveloperView.ts`, toggled via `DeveloperViewToggle.vue` in the header) currently unlocks quick-fill test-data buttons, extra standings stats, and an accessibility-debugging overlay. Separately, `useButtonLogging.ts` already logs every significant button click app-wide (32 call sites) as `{ button, timestamp, ...context }`, but only to the browser console — there's no way to inspect that history in-app. The user wants developer mode to also unlock a panel that shows this action log, so debugging user flows doesn't require opening devtools.

Decisions already confirmed with the user:
- **UI placement**: a slideover panel opened from the header, next to the developer mode toggle — not a new route.
- **Persistence**: `localStorage` ring buffer (recommended over IndexedDB — consistent with the existing `useLocalStorage` pattern already used for `isDeveloperView` itself, synchronous, simple, and sufficient for a capped debug log; IndexedDB would only be justified for much larger retention/querying needs, which don't apply here).

## Approach

Add a capped `localStorage`-backed ring buffer that records every `useButtonLogging().logClick()` call **in addition to** (not instead of) the existing `console.log`. Expose it via a slideover panel opened from a new header trigger button that only renders in developer mode. `useButtonLogging`'s public API (`useButtonLogging(name, context?)` → `{ logClick }`) stays unchanged — all 32 existing call sites need zero changes; the persistence hook is added inside `useButtonLogging.ts`, delegating to a new sibling composable that owns the ring buffer.

## 1. Data model — `ActionLogEntry`

Defined and exported from the new composable (not `#shared/` — this is a client-only debugging concept, not a domain/DB type):

```ts
interface ActionLogEntry {
  id: string                          // crypto.randomUUID(), for :key
  button: string
  timestamp: string                   // ISO string, same as today's console log
  context?: Record<string, unknown>   // already-evaluated (no functions), omitted if empty
}
```

`context` stays free-form (`Record<string, unknown>`) — this is a debugging aid, not a typed audit log, and call sites already pass ad-hoc shapes. Functions in context are evaluated before storage (as `useButtonLogging` already does today for the console log).

## 2. New composable: `app/composables/ui/useActionLog.ts`

- Placement: `ui/` subfolder, alongside `useButtonLogging.ts` (same domain).
- `entries = useLocalStorage<ActionLogEntry[]>('action-log-entries', [])` — same VueUse primitive as `useDeveloperView`'s `isDeveloperView`, shared singleton via key dedup, so writer (`useButtonLogging`) and reader (the panel) never go out of sync — no manual event bus needed.
- Module-scope consts: `ACTION_LOG_KEY = 'action-log-entries'`, `ACTION_LOG_MAX_ENTRIES = 250` (mirrors `useDeveloperView.ts`'s const pattern).
- Exposes:
  - `entries` — the ref (panel reads directly).
  - `recordEntry(entry: Omit<ActionLogEntry, 'id'>)` — appends with generated `id`, then trims oldest-first if `entries.value.length > ACTION_LOG_MAX_ENTRIES`.
  - `clearLog()` — resets `entries.value = []`.
- No SSR deferral needed (unlike patterns that hydrate an always-visible checkbox) — this ref is only ever surfaced inside a `ClientOnly`-wrapped, user-triggered slideover, well after mount.
- Recording is unconditional (not gated by `isDeveloperView`) — matches today's unconditional `console.log`, and avoids retroactively hiding history recorded while developer mode was off. Only *viewing* is gated, via the trigger button's visibility.

## 3. Modify `app/composables/ui/useButtonLogging.ts`

Inside `logClick()`, after building `logData` and after the existing `console.log`, call `useActionLog().recordEntry({ button: buttonName, timestamp: logData.timestamp, context: <evaluatedContext or undefined if empty> })`. No signature change — all 32 call sites untouched.

## 4. New component: `app/components/layout/ActionLogPanel.vue`

Placement: `layout/` (app chrome tied one-to-one to the header, like `DeveloperViewToggle.vue` — not a generic reusable primitive for `ui/`).

- Wraps Nuxt UI's `USlideover` (`@nuxt/ui: ^4.10.0`, standard component for this exact "panel from the side, no route change" need).
- `v-model:open` — owned by `ActionLogTrigger.vue` (see §5), so `ActionLogPanel` stays a dumb presentational piece.
- Header: title (`t('actionLog.title')`), entry count, "Clear log" button.
- Body: `entries` from `useActionLog()`, rendered **newest-first** (reversed computed). Each row: timestamp + button name (collapsed), with an expandable disclosure revealing `context` as `<pre>{{ JSON.stringify(entry.context, null, 2) }}</pre>` when present — no JSON viewer dependency needed for a dev-only aid.
- Empty state when `entries.value.length === 0`: centered message + icon (`t('actionLog.empty')`).
- "Clear log": calls `useActionLog().clearLog()`, paired with `useButtonLogging('Clear Action Log').logClick()` (yes, log this click too — no recursion risk, it's a single finite write), then a success toast (`useToast().add({ title: t('actionLog.clearedToast'), color: 'success' })`).
- No `ConfirmModal` needed — wiping a debug log is low-stakes, not domain data.
- Gating: panel itself has no internal `isDeveloperView` guard — it's simply unreachable when the trigger doesn't render (matches `QuickFillButton`'s "callers don't gate visibility themselves" convention, applied at the trigger level instead).

## 5. New component: `app/components/layout/ActionLogTrigger.vue`

One-button-one-file, matching `DeveloperViewToggle.vue`/`ColorModeSwitch.vue`/`LogoutButton.vue` granularity in this folder.

- `const { isDeveloperView } = useDeveloperView()`; wrapped in `<ClientOnly>` (same reason as `DeveloperViewToggle` — `isDeveloperView` is a `useLocalStorage` ref, empty/false during SSR); renders nothing when off.
- Icon button using a new `ICONS` entry (see §6). `useButtonLogging('Open Action Log').logClick()` on open.
- Owns the `isOpen` ref locally and mounts `<ActionLogPanel v-model:open="isOpen" />` itself — so `HeaderActions.vue` only needs one new line, no ref-lifting required.

**Modify** `app/components/layout/HeaderActions.vue`: add `<ActionLogTrigger />` next to `<DeveloperViewToggle />`, update its doc comment list.

## 6. Icon

Add one entry to `app/utils/icons.ts` (single source of truth per its own convention) — e.g. `actionLog: 'i-lucide-history'` — no existing icon fits (`terminal` is used for the developer toggle itself).

## 7. i18n

New top-level namespace `actionLog` in `i18n/locales/it.json` (sibling to `common`, `league`, etc.):

```json
"actionLog": {
  "title": "Log Azioni",
  "openAriaLabel": "Apri log azioni",
  "empty": "Nessuna azione registrata",
  "clear": "Svuota log",
  "clearedToast": "Log azioni svuotato",
  "entryCount": "{count} azioni registrate"
}
```

## 8b. Extend `useButtonLogging` coverage to remaining tournament-lifecycle actions

The user asked that the action log also capture timer actions, round-stepper actions, and the table-preview approval — not just whatever already happened to be instrumented. Since every `useButtonLogging().logClick()` call automatically flows into the new persisted log (§3), the only work needed here is retrofitting `useButtonLogging` onto the specific lifecycle-relevant buttons that don't call it yet. Checked against the current codebase (not assumed):

- **Already covered, no change needed**: `TablePreviewModal.vue`'s "Conferma tavoli" (table approval) already calls `useButtonLogging`; `TournamentActionBar.vue`'s "Annulla round"/"Avvia evento" already do too; `ConfirmModal.vue`/`ConfirmButton.vue` already log generically (with the dialog's title as context) so `NextRoundModal` and the "Termina torneo" confirm dialog are already captured, just under a generic "Confirm Modal"/"Confirm Button" name.
- **Gaps to fill**:
  - **`app/components/tournament/RoundTimer.vue`** — zero `useButtonLogging` calls today. Add one per action: `start()`, `stop()`, `addMinutes()`, the non-confirm path of `onSubtractClick`/`subtractMinutes`, and the fullscreen `toggle()`. (`reset()`/`confirmSubtractExpire()` already get a generic log via `ConfirmModal`, but adding an explicit one here too — naming the concrete action, e.g. `'Reset timer'` — is more useful than relying on the generic "Confirm Modal" entry; do both, they're not redundant since one names the modal and one names the actual effect.)
  - **`app/components/tournament/TournamentActionBar.vue`** — the `@click="isLastRound ? emit('end') : emit('advance')"` handler has no logging call unlike its siblings in the same file. Add a `useButtonLogging('Avanza round' / 'Termina torneo evento', { currentRound, isLastRound, canAdvance })`-style call (name varies with `isLastRound`, same pattern already used for `cancelRoundLogging`/`startEventLogging` in this file).
  - **`app/components/tournament/TournamentStepper.vue`** — `handleStepClick`'s `emit('viewRound', round)` path has no logging. Add `useButtonLogging('Vai al round', { round, currentRound: props.currentRound })`.
  - **`app/components/tournament/pairing/table/preview/TablePreviewToolbar.vue`** — none of its three emits (`openSettings`/`optimize`/`random`) are logged (this is the toolbar tooltips were just added to). Add `useButtonLogging('Pesi e Vincoli' / 'Ottimizza tavoli' / 'Tavoli casuali')` calls, one per button, mirroring the existing pattern in `TablePreviewModal.vue`'s own "Conferma tavoli" call right next to it.
  - **`app/components/tournament/pairing/kill/KillSystemModal.vue`** — `onConfirm()` currently only sets `confirmed = true` and closes; the actual "Confirm Button" log from `ModalFooterActions` is generic (label `t('common.confirm')`, indistinguishable from every other confirm button in the app). Add `useButtonLogging('Conferma uccisioni', { pairingId: () => props.pairingId, killCount: () => killsStore.kills.length })`, `.logClick()` at the top of `onConfirm()` — same "specific name alongside the generic one" approach as `RoundTimer.vue`'s reset (§8b above), since round-kill data is exactly the kind of thing worth a clearly-named entry when reviewing a contested round later.
  - **`app/components/deck/DeckPlayVotesModal.vue`** (the actual submit button behind `TournamentVotesModal.vue`) — same gap: `@confirm="emit('submit', ...)"` is inline, no named log, only the generic `ConfirmButton` one. Add `useButtonLogging('Conferma voti', { deckVotePlayerId: () => localDeckVotePlayerId.value, playVotePlayerId: () => localPlayVotePlayerId.value })` and switch the inline `@confirm` to a small `handleConfirm()` function that logs then emits (matching the function-per-handler style used everywhere else in this codebase rather than an inline arrow).
  - **`app/components/tournament/pairing/table/preview/TablePreviewModal.vue`** — `handleDragEnd()` (manual seat drag in the preview grid) has no logging today, unlike its "Conferma tavoli" sibling in the same file. Add `useButtonLogging('Sposta giocatore (anteprima tavoli)', { tournamentId: () => tournamentId, currentRound: () => currentRound, wasValid: () => isValid.value })`, `.logClick()` called once at the end of `handleDragEnd()` (after the revert/swap logic resolves), so both successful and reverted moves show up, distinguishable via `wasValid`.
- Each addition follows the exact existing pattern in this codebase: `const xLogging = useButtonLogging('<Italian action name>', { ...lazy getters })`, then `xLogging.logClick()` as the first line of the handler (or, per above, at the resolved end of a multi-step handler like drag-end). No new abstraction — this is purely filling in an existing, established convention at a few more call sites.

## 8c. Systemic gap: row actions and deck forms (audit, not one-off)

Rather than instrument pages one at a time, this closes two **shared-component** gaps that silently affect every list in the app — fixing them here covers league/ruleset/player/tournament/waiting-list edit-delete-view clicks in ~4 files instead of touching every table page individually:

- **`app/components/ui/actions/RowActionButtons.vue`** — the shared edit/view/delete icon group. **Zero logging today**, and it's the actual click target behind `LeagueTable.vue`, `PlayersTable.vue`, `TournamentsTable.vue`, `WaitingListTable.vue`, and the ruleset table (confirmed via grep — 5 consumers). Add three named loggers right in this one file (`useButtonLogging('Row Action: Edit'/'Row Action: View'/'Row Action: Remove')`), called in each button's own handler before `emit(...)` — instruments all 5 tables at once, no per-table changes needed.
- **`app/components/deck/DeckCardActions.vue`** — the deck-card edit/delete buttons on the decks page. Also zero logging (unlike `RowActionButtons`, this one is deck-specific, not shared, but same category of gap). Add `useButtonLogging('Modifica mazzo')`/`useButtonLogging('Elimina mazzo')` in two small handler functions replacing the current inline `@click="emit(...)"`.
- **`app/components/deck/DeckCreateModal.vue`** / **`DeckEditModal.vue`** — unlike `LeagueFormModal.vue` (`'Submit League Form'`) and the ruleset/player equivalents, these two only get the generic `ConfirmButton` log via `FormModal`'s footer, no named one. Add `useButtonLogging('Submit Deck Create Form', {...})` / `useButtonLogging('Submit Deck Edit Form', {...})` in their existing `handleSubmit()` functions, matching the League pattern exactly.

## 8d. Remaining gaps on live pairing tables (`PairingsCard.vue`)

The user specifically asked for full coverage of "actions on tables." Checked `PairingsCard.vue` (the live, in-round table view — distinct from the preview modal already covered in §8b) end to end:

- **Already covered**: "Open Score Modal" and "Toggle Pairings Fullscreen" are already named and logged in this file (`handleOpenScoreModal`, `handleToggleFullscreen`); reset/quick-fill/quick-fill-all/draw/undraw all route through `ConfirmModal`, so they're already captured generically with the dialog's own title as context (same "good enough, distinguishable" tier as `RoundTimer.vue`'s reset — not further named here, consistent with that precedent).
- **Gaps**: four modal-opening actions are wired as bare inline emits in the template with no logging at all, unlike their sibling "Open Score Modal":
  - `@view-scores="emit('openScoresModal', $event)"` (view the scores summary for a table)
  - `@open-kill-modal="emit('openKillModal', $event)"` (open kill entry)
  - `@open-commander-modal="(pairingId, pid) => emit('openCommanderModal', pairingId, pid)"` (open commander selection)
  - `@open-votes-modal="(pairingId, pid) => emit('openVotesModal', pairingId, pid)"` (open vote entry)
  - Fix: turn each into a named handler function (`handleOpenScoresModal`, `handleOpenKillModal`, `handleOpenCommanderModal`, `handleOpenVotesModal`) in `PairingsCard.vue`, each with its own `useButtonLogging(...)` call before emitting — exactly mirroring the existing `handleOpenScoreModal`/`openScoreModalLogging` pattern already in this same file, just applied to the three/four emits that were left inline.

## 8. Testing

- **New**: `test/unit/composables/ui/useActionLog.test.ts` — pure logic (mock `localStorage`): `recordEntry` appends/persists; trim drops oldest-first and keeps exactly the cap count in order; `clearLog` empties; entries with/without `context` round-trip correctly through JSON.
- **Optional, cheap**: extend/add `test/unit/composables/ui/useButtonLogging.test.ts` to assert `logClick()` still calls `console.log` (unchanged) *and* now also produces an entry via `useActionLog().entries` — closes the documented zero-test gap on both files at once (`docs/architecture/testing.md` already flags `useButtonLogging` as untested).
- **Manual verification only**: `ActionLogPanel.vue` / `ActionLogTrigger.vue` rendering, gating, open/close — consistent with the project's current tolerance for other dev-only chrome (`QuickFillButton`, `DeveloperViewToggle`, the overlay) being untested at the component level.

## Files touched

**New**
- `app/composables/ui/useActionLog.ts`
- `app/components/layout/ActionLogPanel.vue`
- `app/components/layout/ActionLogTrigger.vue`
- `test/unit/composables/ui/useActionLog.test.ts`

**Modified**
- `app/composables/ui/useButtonLogging.ts` — add `recordEntry` call, no signature change
- `app/components/layout/HeaderActions.vue` — add `<ActionLogTrigger />`
- `app/utils/icons.ts` — add one icon entry
- `i18n/locales/it.json` — add `actionLog` namespace, plus any new button-name strings needed for §8b's new logging calls
- `app/components/tournament/RoundTimer.vue` — add `useButtonLogging` calls for start/stop/addMinutes/subtract/fullscreen-toggle
- `app/components/tournament/TournamentActionBar.vue` — add `useButtonLogging` for the advance/end click
- `app/components/tournament/TournamentStepper.vue` — add `useButtonLogging` for round navigation clicks
- `app/components/tournament/pairing/table/preview/TablePreviewToolbar.vue` — add `useButtonLogging` for its three toolbar buttons
- `app/components/tournament/pairing/kill/KillSystemModal.vue` — add named `useButtonLogging` for kill confirmation
- `app/components/deck/DeckPlayVotesModal.vue` — add named `useButtonLogging` for vote confirmation
- `app/components/tournament/pairing/table/preview/TablePreviewModal.vue` — add `useButtonLogging` for manual drag-and-drop seat moves
- `app/components/ui/actions/RowActionButtons.vue` — add 3 named loggers (edit/view/remove), covers 5 tables at once
- `app/components/deck/DeckCardActions.vue` — add named loggers for deck edit/delete
- `app/components/deck/DeckCreateModal.vue` / `DeckEditModal.vue` — add named submit-form loggers
- `app/components/tournament/pairing/PairingsCard.vue` — add named loggers for open-scores/open-kill/open-commander/open-votes modal triggers

## Verification

1. `pnpm lint` / `pnpm typecheck` — 0 warnings/errors (project policy).
2. `pnpm vitest run test/unit/composables/ui/useActionLog.test.ts` (and the optional `useButtonLogging` test) pass.
3. Manual: `pnpm dev`, enable developer mode (password `test`), click a few logged buttons around the app, open the new trigger in the header, confirm entries appear newest-first with correct button/timestamp/context, expand context on one, clear the log and confirm it empties + toast fires, refresh the page and confirm entries persisted (until cleared) via localStorage. Also confirm the trigger is invisible when developer mode is off.
4. Manual: run through a full tournament round (start timer, add/subtract time, advance a round via the stepper/action bar, open the table preview and use Pesi e Vincoli/Ottimizza/Random, confirm tables) and verify each action shows up in the panel with a clear, distinguishable name.
