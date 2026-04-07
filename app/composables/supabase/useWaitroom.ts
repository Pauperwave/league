import type { WaitroomEntry } from '#shared/utils/types'

/**
 * Composable per fetchare la lista d'attesa.
 * Usa lo store players come single source of truth.
 */
export function useWaitroom(eventId?: number) {
  const store = usePlayerStore()
  const key = eventId ? `waitroom-${eventId}` : 'waitroom-all'

  const { data, pending, error } = useAsyncData<WaitroomEntry[]>(key, async () => {
    if (eventId) {
      await store.fetchWaitingPlayers(eventId)
    }
    // Mappa waitingPlayers (number[]) a WaitroomEntry[]
    return store.waitingPlayers.map((playerId, index) => ({
      wait_id: index,
      event_id: eventId || 0,
      player_id: playerId
    }))
  }, {
    server: true,
    default: () => [],
    watch: [() => eventId]
  })

  return {
    data,
    pending,
    error,
    refresh: () => eventId ? store.fetchWaitingPlayers(eventId) : Promise.resolve()
  }
}
