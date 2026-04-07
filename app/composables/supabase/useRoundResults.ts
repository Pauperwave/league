import type { RoundResult } from '#shared/utils/types'

/**
 * Composable per fetchare i risultati dei round.
 * I dati sono inclusi nei pairings via round_results.
 * Usa lo store events come single source of truth.
 */
export function useRoundResults(pairingId?: number) {
  const store = useEventStore()
  const key = pairingId ? `round-results-${pairingId}` : 'round-results-all'

  const { data, pending, error } = useAsyncData<RoundResult[]>(key, async () => {
    if (pairingId) {
      // Trova il pairing con il round_results
      const pairing = store.pairings.find(p => p.pairing_id === pairingId)
      return pairing?.round_results || []
    }
    // Ritorna tutti i round_results da tutti i pairings
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
    refresh: () => Promise.resolve() // I round_results vengono fetchati con i pairings
  }
}
