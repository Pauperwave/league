// app\composables\players\usePlayerStats.ts
import type { PlayerStat } from '#shared/utils/types'

/** Query key for a single player's denormalized stats. */
export const PLAYER_STATS_KEY = ['player-stats']

/** A player's denormalized stats from the `player_stats` table (Colada, ADR-015). */
export function usePlayerStats(playerId: MaybeRefOrGetter<number | undefined>) {
  const supabase = useSupabaseClient()

  const { data, isLoading, error } = useQuery({
    key: () => [...PLAYER_STATS_KEY, toValue(playerId) ?? 'none'],
    enabled: () => toValue(playerId) !== undefined,
    query: async (): Promise<PlayerStat | null> => {
      const id = toValue(playerId)
      if (!id) return null
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  return { data, pending: isLoading, error }
}

/** Query key for the full player_stats table (players list page). */
export const ALL_PLAYER_STATS_KEY = ['all-player-stats']

/**
 * All player stats at once, for listings. Exposes `getStat` in the same
 * shape as the retired `usePlayerStatsStore` so template bindings
 * (`:get-player-stat="getStat"`) keep working unchanged.
 */
export function useAllPlayerStats() {
  const supabase = useSupabaseClient()

  const { data, isLoading } = useQuery({
    key: ALL_PLAYER_STATS_KEY,
    query: async (): Promise<PlayerStat[]> => {
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
      if (error) throw error
      return data ?? []
    },
  })

  function getStat(playerId: number, key: string): number {
    const stat = (data.value ?? []).find(s => s.player_id === playerId)
    if (!stat) return 0
    return (stat as unknown as Record<string, number>)[key] ?? 0
  }

  return { stats: computed(() => data.value ?? []), isLoading, getStat }
}
