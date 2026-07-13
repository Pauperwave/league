// app\composables\commanders\useCommanderStats.ts
import type { CommanderAggregate } from '#shared/utils/types'
import { applyCommander2Filter } from '../supabase/useStatsQueryBuilder'

/** SSR-friendly composable for fetching global commander stats from commander_stats materialized view */
export function useCommanderStats(
  commander1Name: Ref<string | undefined>,
  commander2Name: Ref<string | null | undefined>
) {
  const supabase = useSupabaseClient()

  const { data, pending, error } = useAsyncData(
    () => `commander-stats-by-commander-${commander1Name.value ?? 'none'}`,
    async () => {
      if (!commander1Name.value) return null
      const query = applyCommander2Filter(
        supabase.from('commander_stats').select('*').eq('commander_1', commander1Name.value),
        commander2Name.value
      )
      const { data, error } = await query.single()
      if (error) throw error
      return data as unknown as CommanderAggregate
    },
    {
      immediate: true,
      server: true,
      watch: [commander1Name, commander2Name],
    }
  )

  return { data, pending, error }
}

/** Fetch all commander stats at once for listings */
export function useAllCommanderStats() {
  const supabase = useSupabaseClient()

  const { data, pending, error } = useAsyncData(
    'all-commander-stats',
    async () => {
      const { data, error } = await supabase
        .from('commander_stats')
        .select('*')
      if (error) throw error
      return data as unknown as CommanderAggregate[]
    },
    {
      immediate: true,
      server: true,
    }
  )

  return { data, pending, error }
}
