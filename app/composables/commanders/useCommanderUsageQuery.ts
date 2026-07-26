// app\composables\commanders\useCommanderUsageQuery.ts
import type { Database } from '#shared/utils/types/database'

/** Per-commander play history for one player (ADR-027): most recently
 *  played first, ties on the same calendar day broken by play count. */
export interface CommanderUsage {
  /** ISO `YYYY-MM-DD` (UTC) of the most recent pairing this commander was
   *  played in — plain string comparison sorts these chronologically. */
  lastPlayedDay: string
  count: number
}

function recordUsage(usage: Map<string, CommanderUsage>, name: string | null, day: string) {
  if (!name) return
  const existing = usage.get(name)
  if (!existing) {
    usage.set(name, { lastPlayedDay: day, count: 1 })
    return
  }
  existing.count += 1
  if (day > existing.lastPlayedDay) existing.lastPlayedDay = day
}

async function fetchCommandersUsage(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  playerIds: number[]
): Promise<Map<number, Map<string, CommanderUsage>>> {
  const byPlayer = new Map<number, Map<string, CommanderUsage>>()
  if (playerIds.length === 0) return byPlayer

  const { data, error } = await supabase
    .from('round_results')
    .select('player_id, commander_1, commander_2, pairings(pairing_datetime)')
    .in('player_id', playerIds)

  if (error || !data) return byPlayer

  for (const row of data) {
    const pairing = Array.isArray(row.pairings) ? row.pairings[0] : row.pairings
    const day = pairing?.pairing_datetime?.slice(0, 10) ?? ''
    let usage = byPlayer.get(row.player_id)
    if (!usage) {
      usage = new Map()
      byPlayer.set(row.player_id, usage)
    }
    recordUsage(usage, row.commander_1, day)
    recordUsage(usage, row.commander_2, day)
  }
  return byPlayer
}

/**
 * Batch-fetches "which commanders has each of these players played before"
 * in a single request instead of one query per player (2026-07-26 follow-up
 * to ADR-027 — see docs/TODO.md's "Prefetch commander usage per table"
 * entry). Cache key is the sorted player id list, so a caller asking for the
 * same roster (e.g. every seated player at a table, prefetched by
 * PairingsCard before any modal opens) shares one cached result with every
 * commander modal opened for that roster — no per-modal network round-trip.
 */
export function useCommanderUsageQuery(playerIds: MaybeRefOrGetter<number[]>) {
  const supabase = useSupabaseClient<Database>()

  const sortedIds = computed(() => [...toValue(playerIds)].sort((a, b) => a - b))

  return useQuery({
    key: () => ['commander-usage', ...sortedIds.value.map(String)],
    query: () => fetchCommandersUsage(supabase, sortedIds.value),
    enabled: () => sortedIds.value.length > 0,
  })
}
