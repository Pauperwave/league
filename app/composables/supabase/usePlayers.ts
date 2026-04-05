import type { Player } from '~/types/database'

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
