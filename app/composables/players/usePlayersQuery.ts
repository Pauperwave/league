// app\composables\players\usePlayersQuery.ts
// Pinia Colada query for the players list (ADR-015). Reads stay client →
// Supabase (ADR-013); this list is the single players cache — lookups and
// option lists derive from it. Successor of the players store + the
// 'players' useAsyncData wrapper.
import type { Player } from '#shared/utils/types'

/** Query key for the players list — invalidated by usePlayerMutations. */
export const PLAYERS_KEY = ['players']

/**
 * Sanitizes player names by replacing underscores with spaces.
 * The database uses underscores for compound names (e.g., "Mario_Rossi").
 * This transforms them to human-readable format (e.g., "Mario Rossi").
 */
export function sanitizePlayer<T extends Partial<Player>>(player: T): T {
  return {
    ...player,
    player_name: player.player_name?.replace(/_/g, ' ') ?? '',
    player_surname: player.player_surname?.replace(/_/g, ' ') ?? ''
  }
}

export function usePlayersQuery() {
  const supabase = useSupabaseClient()

  return useQuery({
    key: PLAYERS_KEY,
    query: async (): Promise<Player[]> => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('player_name')

      if (error) throw error
      return (data ?? []).map(p => sanitizePlayer(p))
    },
  })
}

/**
 * Transforms a list of players into options for USelectMenu
 */
export function usePlayerOptions(players: MaybeRefOrGetter<Player[]>) {
  return computed(() => {
    const playersList = toValue(players)
    return playersList.map(player => ({
      label: `${player.player_name} ${player.player_surname}`,
      value: String(player.player_id),
    }))
  })
}
