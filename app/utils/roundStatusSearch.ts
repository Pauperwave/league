// app\utils\roundStatusSearch.ts

/**
 * The status filter for RoundStatusCard.vue. No "in progress" state today —
 * there's no real-time "who is filling this in right now" data, only a
 * binary done/not-done per row (see docs/PROGRESS.md ADR-031 on this card,
 * and BACKLOG.md for reintroducing it once that data exists).
 */
export type RoundStatusFilter = 'all' | 'pending' | 'done'

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
