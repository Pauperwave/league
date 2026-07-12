import type { WaitroomEntry } from '#shared/utils/types'

/**
 * Composable for fetching the waiting list.
 * Uses the players store as the single source of truth.
 */
export function useWaitroom(eventId?: number) {
  const store = usePlayerStore()
  const key = eventId ? `waitroom-by-event-${eventId}` : 'waitroom-all'

  const { data, pending, error } = useAsyncData<WaitroomEntry[]>(key, async () => {
    if (eventId) {
      await store.fetchWaitingPlayers(eventId)
    }
    return store.waitingPlayers.map((playerId, index) => ({
      wait_id: index,
      event_id: eventId || 0,
      player_id: playerId,
      inserted_at: store.waitroomEntries.get(playerId) || null
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
