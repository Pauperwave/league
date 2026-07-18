// app\composables\commanders\useDeckStats.ts
import { applyCommander2Filter } from '../supabase/useStatsQueryBuilder'

/** Query key for a player's denormalized deck stats. */
export const DECK_STATS_KEY = ['deck-stats']

/** A player's denormalized deck stats from the `deck_stats` table (Colada, ADR-015). */
export function useDeckStats(
  playerId: MaybeRefOrGetter<number | undefined>,
  commander1Name: MaybeRefOrGetter<string | undefined>,
  commander2Name: MaybeRefOrGetter<string | null | undefined>
) {
  const supabase = useSupabaseClient()

  const { data, isLoading, error } = useQuery({
    key: () => [...DECK_STATS_KEY, toValue(playerId) ?? 'none', toValue(commander1Name) ?? 'none'],
    enabled: () => toValue(playerId) !== undefined && !!toValue(commander1Name),
    query: async () => {
      const id = toValue(playerId)
      const name1 = toValue(commander1Name)
      if (!id || !name1) return null
      const query = applyCommander2Filter(
        supabase.from('deck_stats').select('*').eq('player_id', id).eq('commander_1', name1),
        toValue(commander2Name)
      )
      const { data, error } = await query.single()
      if (error) throw error
      return data
    },
  })

  return { data, pending: isLoading, error }
}
