// app\composables\commanders\useCommanderAggregate.ts
import type { CommanderAggregate } from '#shared/utils/types'

export interface SingleCommanderAggregate {
  name: string
  playerCount: number
  matchCount: number
  winCount: number
  totalKills: number
  averageScore: number
}

/**
 * Aggregates `commander_stats` (pair-level rows, e.g. "A" alone or "A + B")
 * into a single-commander view: sums across every pair a commander has
 * appeared in, in either the `commander_1` or `commander_2` slot (BACKLOG
 * #10). `averageScore` is match-count-weighted, not a plain mean of each
 * pair's own average, so a pair played once doesn't skew the number as much
 * as one played 50 times.
 *
 * Known approximation, not a bug: `playerCount` sums each pair's own
 * distinct-player count, so a player who has played this commander with two
 * different partners is counted twice. A real distinct-player count would
 * need a query over `round_results` directly instead of the pre-aggregated
 * `commander_stats` view — left as a known limitation (see BACKLOG #10)
 * rather than adding that query for a first version.
 */
export function aggregateSingleCommander(pairs: CommanderAggregate[], name: string): SingleCommanderAggregate | null {
  const matching = pairs.filter(p => p.commander_1 === name || p.commander_2 === name)
  if (matching.length === 0) return null

  const matchCount = matching.reduce((sum, p) => sum + p.match_count, 0)
  const weightedScoreSum = matching.reduce((sum, p) => sum + p.average_score * p.match_count, 0)

  return {
    name,
    playerCount: matching.reduce((sum, p) => sum + p.player_count, 0),
    matchCount,
    winCount: matching.reduce((sum, p) => sum + p.win_count, 0),
    totalKills: matching.reduce((sum, p) => sum + p.total_kills, 0),
    averageScore: matchCount > 0 ? weightedScoreSum / matchCount : 0,
  }
}

/**
 * Every distinct individual commander name appearing in either slot of
 * `commander_stats`, sorted alphabetically — for a "browse all commanders"
 * list. Guards against null/empty names despite `CommanderAggregate`'s
 * non-null type: a bad row (`commander_1 IS NULL`) exists in the live table,
 * and an unguarded `.add()` here crashed `localeCompare` on the null entry.
 */
export function getAllCommanderNames(pairs: CommanderAggregate[]): string[] {
  const names = new Set<string>()
  for (const pair of pairs) {
    if (pair.commander_1) names.add(pair.commander_1)
    if (pair.commander_2) names.add(pair.commander_2)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** Single-commander aggregate stats, computed client-side from the already-cached `commander_stats` table (Colada, ADR-015 — see `useAllCommanderStats`). */
export function useSingleCommanderStats(name: MaybeRefOrGetter<string | null | undefined>) {
  const { data: allStats, pending, error } = useAllCommanderStats()

  const data = computed(() => {
    const n = toValue(name)
    if (!n || !allStats.value) return null
    return aggregateSingleCommander(allStats.value, n)
  })

  return { data, pending, error }
}
