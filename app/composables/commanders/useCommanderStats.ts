// app\composables\commanders\useCommanderStats.ts
import type { CommanderAggregate } from '#shared/utils/types'
import { applyCommander2Filter } from '../supabase/useStatsQueryBuilder'

/** Query key for a single commander's aggregate stats. */
export const COMMANDER_STATS_KEY = ['commander-stats']

/** Global aggregate stats for a commander (pair) from the `commander_stats` materialized view (Colada, ADR-015). */
export function useCommanderStats(
  commander1Name: MaybeRefOrGetter<string | undefined>,
  commander2Name: MaybeRefOrGetter<string | null | undefined>
) {
  const supabase = useSupabaseClient()

  const { data, isLoading, error } = useQuery({
    key: () => [...COMMANDER_STATS_KEY, toValue(commander1Name) ?? 'none'],
    enabled: () => !!toValue(commander1Name),
    query: async () => {
      const name1 = toValue(commander1Name)
      if (!name1) return null
      const query = applyCommander2Filter(
        supabase.from('commander_stats').select('*').eq('commander_1', name1),
        toValue(commander2Name)
      )
      const { data, error } = await query.single()
      if (error) throw error
      return data as unknown as CommanderAggregate
    },
  })

  return { data, pending: isLoading, error }
}

/** Query key for the full commander_stats table (browse listings). */
export const ALL_COMMANDER_STATS_KEY = ['all-commander-stats']

/** All commander stats at once, for listings (Colada, ADR-015). */
export function useAllCommanderStats() {
  const supabase = useSupabaseClient()

  const { data, isLoading, error } = useQuery({
    key: ALL_COMMANDER_STATS_KEY,
    query: async (): Promise<CommanderAggregate[]> => {
      const { data, error } = await supabase
        .from('commander_stats')
        .select('*')
      if (error) throw error
      return data as unknown as CommanderAggregate[]
    },
  })

  return { data, pending: isLoading, error }
}
