import type { Event } from '#shared/utils/types'

/**
 * Composable per fetchare eventi.
 * Usa lo store come single source of truth.
 */
export function useEvents(leagueId?: MaybeRef<number>) {
  const store = useEventStore()
  const leagueIdRef = toRef(leagueId)
  const key = computed(() => leagueIdRef.value ? `events-${leagueIdRef.value}` : 'events-all')

  const { data, pending, error, refresh } = useAsyncData<Event[]>(key, async () => {
    if (!leagueIdRef.value) return []
    await store.fetchEvents(leagueIdRef.value, true)
    return store.getEventsByLeagueId(leagueIdRef.value)
  }, {
    server: true,
    default: () => [] as Event[],
    watch: [leagueIdRef]
  })

  return {
    data,
    pending,
    error,
    refresh
  }
}
