// app\utils\roundStatusSearch.ts

/**
 * The 3-state status filter for RoundStatusCard.vue. 'inProgress' has no
 * distinct signal today (no real-time "who is filling this in right now"
 * data) — it collapses to the same "not done" predicate as 'pending' until
 * a future realtime source can tell them apart (see docs/PROGRESS.md ADR
 * on this card).
 */
export type RoundStatusFilter = 'all' | 'pending' | 'inProgress' | 'done'

/** True if `done` should be shown under the given status filter. */
export function matchesRoundStatusFilter(done: boolean, filter: RoundStatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'done') return done
  return !done
}

/** Case-insensitive substring match; an empty/whitespace-only query always matches. */
export function matchesRoundStatusSearch(haystack: string, query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true
  return haystack.toLowerCase().includes(trimmed)
}

/**
 * Search haystack for a table number — matches both a bare "1" and the
 * translated heading ("Tavolo 1"). `tableHeading` is the already-resolved
 * i18n string so this stays free of `useI18n()` and unit-testable.
 */
export function tableSearchLabel(tableNumber: number, tableHeading: string): string {
  return `${tableNumber} ${tableHeading}`
}
