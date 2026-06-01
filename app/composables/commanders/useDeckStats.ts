// app\composables\supabase\useDeckStats.ts
import { applyCommander2Filter } from '../supabase/useStatsQueryBuilder'

/** SSR-friendly composable for fetching denormalized deck stats from deck_stats table */
export function useDeckStats(
  playerId: Ref<number | undefined>,
  commander1Name: Ref<string | undefined>,
  commander2Name: Ref<string | null | undefined>
) {
  const supabase = useSupabaseClient()

  const { data, pending, error } = useAsyncData(
    () => `deck-stats-by-player-${playerId.value ?? 'none'}-commander-${commander1Name.value ?? 'none'}`,
    async () => {
      if (!playerId.value || !commander1Name.value) return null
      const query = applyCommander2Filter(
        supabase.from('deck_stats').select('*').eq('player_id', playerId.value).eq('commander_1', commander1Name.value),
        commander2Name.value
      )
      const { data, error } = await query.single()
      if (error) throw error
      return data
    },
    {
      immediate: true,
      server: true,
      watch: [playerId, commander1Name, commander2Name],
    }
  )

  return { data, pending, error }
}
