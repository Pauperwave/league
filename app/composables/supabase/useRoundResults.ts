import type { RoundResult } from '#shared/utils/types'

/**
 * Composable for fetching round results.
 * The data is included in the pairings via round_results.
 * Uses the events store as the single source of truth.
 */
export function useRoundResults(pairingId?: number) {
  const store = useEventStore()
  const key = pairingId ? `round-results-by-pairing-${pairingId}` : 'round-results-all'

  const { data, pending, error } = useAsyncData<RoundResult[]>(key, async () => {
    if (pairingId) {
      // Find the pairing with its round_results
      const pairing = store.pairings.find(p => p.pairing_id === pairingId)
      return pairing?.round_results || []
    }
    // Return all round_results from all pairings
    return store.pairings.flatMap(p => p.round_results || [])
  }, {
    server: true,
    default: () => [],
    watch: [() => pairingId]
  })

  return {
    data,
    pending,
    error,
    refresh: () => Promise.resolve() // round_results are fetched along with the pairings
  }
}
