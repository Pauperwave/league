# URL Query Parameters

## Overview

Six query parameters synchronize the tournament page state with the URL, enabling deep links, refresh persistence, and browser back/forward navigation.

**Core composable:** `app/composables/tournament/useTournamentUrl.ts`

---

## Parameter Reference

| Param | Type | Example | Purpose |
|-------|------|---------|---------|
| `phase` | `'registration'` \| `'playing'` \| `'ended'` | `phase=playing` | Tournament stepper phase |
| `round` | number | `round=2` | Current/next round number |
| `preview` | `1` (present/absent) | `preview=1` | Preview overlay open (appended to actual phase) |
| `scoreModal` | pairing ID | `scoreModal=123` | Score/ranking modal |
| `killModal` | pairing ID | `killModal=7` | Kill system flow modal |
| `votesModal` | player ID | `votesModal=42` | Brew/play votes modal |
| `commanderModal` | player ID | `commanderModal=42` | Commander selection modal |

---

## Phase + Round (`phase`, `round`)

### How they're set

- **`syncUrl(phase, round)`** in `useTournamentUrl.ts` — replaces the URL with current phase and round, preserving other params.
- **Automatic watcher** in `useTournamentPage.ts`: watches `[currentPhase, currentRound]` and calls `syncUrl()` whenever they change. The watcher skips if the URL already matches to avoid unnecessary replacements on page reload.

### Phase transitions

| Transition | Trigger | URL change |
|---|---|---|
| Registration | Tournament created | `phase=registration` |
| Registration → Preview | Click "Avvia Torneo" | `phase=registration&preview=1` |
| Confirm start | Click "Conferma" in preview | `phase=playing&round=1` |
| Playing (round N) | Advance confirmed | `phase=playing&round=N` |
| Playing → Preview (advance) | Click "Avanti" | `phase=playing&round=N&preview=1` |
| Confirm advance | Click "Conferma" in preview | `phase=playing&round=N` (new round created) |
| Cancel round | Click "Annulla round" | `phase=playing&round=N-1` |
| Tournament ended | Last round confirmed | `phase=ended` |
| Stepper phase change | User clicks stepper step | Any phase → the clicked phase |

### URL examples

```
Normal playing state:           ?phase=playing&round=2
Preview before advance:         ?phase=playing&round=2&preview=1
With modal overlay:             ?phase=playing&round=2&scoreModal=123
Preview + modal:                ?phase=playing&round=2&preview=1&scoreModal=123
```

### Preview param (separate from phase)

The `preview` param is independent of `phase`. This means:

- **`phase` always reflects the actual tournament state** — no "fake" phase value like `previewTables`.
- The auto-watcher that syncs `phase`/`round` never conflicts with the preview overlay, because `phase` stays correct (e.g., `playing`) while `preview=1` is added on top.
- The preview state is managed by `syncPreview(isOpen)` and `previewFromQuery`.

### Preview modal watcher

In `[tournamentId].vue`:

```ts
watch(showStartPreviewModal, (isOpen) => {
  syncPreview(isOpen)
})

watch(previewFromQuery, (isPreview) => {
  if (isPreview) {
    showStartPreviewModal.value = true
  }
})
```

---

## Modal Params (scoreModal, killModal, votesModal, commanderModal)

### Shared pattern

All four modal params follow the same bidirectional pattern:

1. Each has a **`sync*Modal(isOpen, id)`** function that adds/removes the param via `router.replace`
2. Each has a **`*ModalFromQuery`** computed that reads the param from the URL
3. A **watcher on the modal's `isOpen` ref** calls `sync*Modal()` on open/close
4. A **watcher on the `*ModalFromQuery`** opens the modal automatically when the param is present

All four modals are controlled from **`[tournamentId].vue`** — the parent page manages all `show*Modal` refs, `selected*Id` refs, and URL sync watchers.

### Score modal (`scoreModal`)

- **Param value:** Pairing ID (number)
- **Trigger:** Button "Classifica" in PairingsCard per-table
- **Watcher:** `watch(showScoreModal, ...)` → `syncScoreModal()`
- **Restore:** `watch(scoreModalFromQuery, ...)` → finds pairing, opens modal
- **URL:** `?phase=playing&round=2&scoreModal=123`

### Kill modal (`killModal`)

- **Param value:** Pairing ID (number)
- **Trigger:** Button "Uccisioni" in PairingsCard per-table
- **Watcher:** `watch(showKillModal, ...)` → `syncKillModal()`
- **Restore:** `watch(killModalFromQuery, ...)` → sets `selectedKillPairingId`, opens modal
- **URL:** `?phase=playing&round=2&killModal=7`

### Votes modal (`votesModal`)

- **Param value:** Player ID (the voter)
- **Trigger:** Star button per-player in each table card
- **Watcher:** `watch(showVotesModal, ...)` → `syncVotesModal()`
- **Restore:** `watch(votesModalFromQuery, ...)` → finds pairing for player, opens modal
- **URL:** `?phase=playing&round=2&votesModal=42`

### Commander modal (`commanderModal`)

- **Param value:** Player ID
- **Trigger:** Shield button per-player in each table card
- **Watcher:** `watch(showCommanderModal, ...)` → `syncCommanderModal()`
- **Restore:** `watch(commanderModalFromQuery, ...)` → finds pairing for player, opens modal
- **URL:** `?phase=playing&round=2&commanderModal=42`

### Implementation detail

Each modal param uses the same filter pattern:

```ts
function syncScoreModal(isOpen: boolean, pairingId: number | null) {
  const newQuery: Record<string, string> = {}
  Object.entries(route.query).forEach(([key, value]) => {
    if (typeof value === 'string' && key !== 'scoreModal') {
      newQuery[key] = value
    }
  })
  if (isOpen && pairingId !== null) {
    newQuery.scoreModal = String(pairingId)
  }
  router.replace({ query: newQuery })
}
```

---

## Key Behaviors

1. **`router.replace`** (not `push`) — avoids polluting browser history
2. **Preserves unknown params** — all params except the one being synced are copied as-is
3. **Page load restore** — watchers on `*FromQuery` detect existing params on mount and restore the corresponding modal
4. **`preview` is independent of `phase`** — never conflicts with auto-sync, no special-case skip logic needed

---

## Architecture Evolution

| Before | After | Reason |
|--------|-------|--------|
| `phase=previewTables` (fake phase) | `preview=1` (separate param) | `phase` always reflects actual tournament state; no auto-sync conflicts |
| Kill URL sync inside `KillSystemModal.vue` | Kill URL sync in `[tournamentId].vue` (like other modals) | Uniform pattern for all 4 modals; `v-model:open` from parent |
| Trigger button inside `UModal` default slot | Trigger button in `PairingsCard` as plain `UButton` | Matches score/commander/votes pattern; modal externally controlled |
