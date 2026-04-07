import type { StandingWithPlayer } from '#shared/utils/types'

/**
 * Composable per fetchare le classifiche.
 * Usa lo store events come single source of truth.
 */
export function useStandings(eventId?: number) {
  const store = useEventStore()
  const key = eventId ? `standings-${eventId}` : 'standings-all'

  const { data, pending, error } = useAsyncData<StandingWithPlayer[]>(key, async () => {
    if (eventId) {
      await store.fetchStandings(eventId)
    }
    return eventId
      ? store.standings.filter((s: StandingWithPlayer) => s.event_id === eventId)
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

/**
 * Composable per fetchare le classifiche di più eventi contemporaneamente.
 * Utile per visualizzare punteggi per evento in una lega.
 */
export function useMultipleEventStandings(eventIds: MaybeRef<number[]>) {
  const store = useEventStore()
  const eventIdsRef = toRef(eventIds)
  const key = computed(() => `standings-multi-${eventIdsRef.value.join('-')}`)

  const { data, pending, error, refresh } = useAsyncData<StandingWithPlayer[]>(
    key,
    async () => {
      if (!eventIdsRef.value?.length) return []
      return await store.fetchMultipleEventStandings(eventIdsRef.value)
    },
    {
      server: true,
      default: () => [] as StandingWithPlayer[],
      watch: [eventIdsRef]
    }
  )

  return {
    data,
    pending,
    error,
    refresh
  }
}
