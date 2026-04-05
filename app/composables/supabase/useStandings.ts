import type { Standing } from '~/types/database'

/**
 * Composable per fetchare le classifiche.
 * Usa lo store events come single source of truth.
 */
export function useStandings(eventId?: number) {
  const store = useEventStore()
  const key = eventId ? `standings-${eventId}` : 'standings-all'

  const { data, pending, error } = useAsyncData<Standing[]>(key, async () => {
    if (eventId) {
      await store.fetchStandings(eventId)
    }
    return eventId
      ? store.standings.filter(s => s.event_id === eventId)
      : store.standings
  }, {
    server: true,
    default: () => [],
    watch: [() => eventId]
  })

  return {
    data,
    pending,
    error,
    refresh: () => eventId ? store.fetchStandings(eventId) : Promise.resolve()
  }
}
