import type { Pairing } from '#shared/utils/types'

/**
 * Composable per fetchare i pairing.
 * Usa lo store events come single source of truth.
 */
export function usePairings(eventId?: number, round?: number) {
  const store = useEventStore()
  const keyParts = ['pairings']
  if (eventId) keyParts.push(`event-${eventId}`)
  if (round) keyParts.push(`round-${round}`)
  const key = keyParts.join('-')

  const { data, pending, error } = useAsyncData<Pairing[]>(key, async () => {
    if (eventId && round) {
      await store.fetchPairings(eventId, round)
    }
    return store.pairings
  }, {
    server: true,
    default: () => [],
    watch: [() => eventId, () => round]
  })

  return {
    data,
    pending,
    error,
    refresh: () => (eventId && round) ? store.fetchPairings(eventId, round) : Promise.resolve()
  }
}
