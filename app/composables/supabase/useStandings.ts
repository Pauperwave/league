// app\composables\supabase\useStandings.ts
import type { StandingWithPlayer } from '#shared/utils/types'

/**
 * Composable for fetching standings.
 * Uses the events store as the single source of truth.
 */
export function useStandings(eventId?: number) {
  const store = useEventStore()
  const key = eventId ? `standings-by-event-${eventId}` : 'standings-all'

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
 * Composable for fetching standings for multiple events at once.
 * Useful for displaying per-event scores within a league.
 */
export function useMultipleEventStandings(eventIds: MaybeRef<number[]>) {
  const store = useEventStore()
  const eventIdsRef = toRef(eventIds)
  const key = computed(() => `standings-multi-event-${eventIdsRef.value.join('-')}`)

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
