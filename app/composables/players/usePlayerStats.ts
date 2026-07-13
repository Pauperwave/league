// app\composables\players\usePlayerStats.ts
/** SSR-friendly composable for fetching denormalized player stats from player_stats table */
export function usePlayerStats(playerId: Ref<number | undefined>) {
  const supabase = useSupabaseClient()

  const { data, pending, error } = useAsyncData(
    () => `player-stats-by-player-${playerId.value ?? 'none'}`,
    async () => {
      if (!playerId.value) return null
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', playerId.value)
        .single()
      if (error) throw error
      return data
    },
    {
      immediate: true,
      server: true,
      watch: [playerId],
    }
  )

  return { data, pending, error }
}
