# Event Flow and Standings Design

Date: 2026-05-26
Status: Draft for review

## Goals
- Fix table preview timing and last-round flow issues from `docs/bugs.md`.
- Add partial/final standings in a right-column panel, updating live.
- Add per-player "Inserito" badge in partial standings when score submitted.
- Improve single table UI layout (hybrid) while preserving existing components.

## Non-Goals
- No database schema changes.
- No large refactors of the event page structure.
- No new UI libraries beyond Nuxt UI + Tailwind v4.

## Scope Summary
- Event flow: preview timing, last-round button label and confirm, show final standings on end.
- Standings panel: partial during playing, final during ended, badges for submitted players.
- Table card layout: header + hybrid grid, keep "Classifica" and "Kills" as separate group actions, group "Commander" and "Voti"; remove top-left icon.

## Architecture and Components

### Event page flow
- Update `[eventId].vue` to derive `isLastRound`, `shouldShowPreview`, and `standingsMode`.
- `handleAdvance`:
  - If `isLastRound`, open a new confirm modal for ending the event.
  - Else trigger auto-optimization before opening preview (no confirm-side optimization).
- `TablePreviewModal` confirm will only apply the already-optimized order.

### Standings panel
- Reuse `app/components/events/Standings/StandingsCard.vue` with small prop additions or wrapper:
  - Title changes: "Classifica Parziale" vs "Classifica Finale".
  - Optional badge per row: "Inserito" if player has a saved ranking for current round.
- Placement: right column beside tables during playing; visible in ended state as final standings.

### Table card layout (hybrid)
- Keep existing `TableCard` and subcomponents, adjust layout only:
  - Header row: table number + status.
  - Body: two-column grid (players left, actions right).
  - Actions: "Classifica" (separate) and "Kills" (separate) as group actions; "Commander" and "Voti" grouped together.
  - Remove the top-left icon.
- Reserve a small placeholder area for future player self-entry (disabled/hidden by default).

## Data Flow
- Standings badge mapping:
  - For each standing row, check if the player has a saved ranking in the current round.
  - Use `rankingsStore.getRankingWithRanks(pairingId)` to derive per-player submitted status.
  - Map from `pairings` to `standing.player_id` using current round pairings.
- Live updates: the partial standings panel reacts to `rankingsStore` changes.

## Error Handling
- Use existing toast patterns for async saves.
- Do not block the UI on save failures; show error toast when needed.

## Accessibility
- Ensure badges have text labels ("Inserito") and do not rely on color alone.
- Keep button labels and tooltips consistent.

## Testing
- Vitest: add unit tests for last-round flow decisions and standings badge mapping logic.
- E2E: optional follow-up (not required for this change set).

## Affected Files (expected)
- `app/pages/league/[leagueId]/event/[eventId].vue`
- `app/components/events/Pairings/Table/TablePreviewModal.vue`
- `app/components/events/Standings/StandingsCard.vue` (or wrapper)
- `app/components/events/Pairings/Table/TableCard.vue`

## Open Questions
- None. DB changes explicitly deferred by user.
