import type { Player } from '#shared/utils/types'

/**
 * Composable for fetching players.
 * Uses the store as the single source of truth.
 */
export function usePlayers() {
  const store = usePlayerStore()

  const { data, pending, error } = useAsyncData<Player[]>('players', async () => {
    await store.fetchPlayers()
    return store.players
  }, {
    server: true,
    default: () => []
  })

  return {
    data,
    pending,
    error,
    refresh: () => store.fetchPlayers(true)
  }
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
