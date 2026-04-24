import type { Player } from '#shared/utils/types'

/**
 * Composable per fetchare i giocatori.
 * Usa lo store come single source of truth.
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
 * Trasforma una lista di giocatori in opzioni per USelectMenu
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
