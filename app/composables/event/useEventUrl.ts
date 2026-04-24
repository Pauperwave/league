// league\app\composables\event\useEventUrl.ts
export function useEventUrl() {
  const route = useRoute()
  const router = useRouter()

  // Read phase from query parameter
  const phaseFromQuery = computed(() => route.query.phase as string | undefined)

  // Read round from query parameter
  const roundFromQuery = computed(() => {
    const round = route.query.round
    return round ? parseInt(round as string) || null : null
  })

  /**
   * Sync URL with current phase and round
   * @param currentPhase - Current event phase ('registration' | 'playing' | 'ended' | 'preview')
   * @param currentRound - Current round number
   */
  function syncUrl(currentPhase: 'registration' | 'preview' | 'playing' | 'ended', currentRound: number) {
    console.log('[SYNC URL] Called', { currentPhase, currentRound, currentQuery: route.query })
    const newQuery: Record<string, string> = {}

    // Copy existing valid query params
    Object.entries(route.query).forEach(([key, value]) => {
      if (typeof value === 'string' && key !== 'phase' && key !== 'round' && key !== 'scoreModal') {
        newQuery[key] = value
      }
    })

    // Update phase
    newQuery.phase = currentPhase

    // Update round if changed (only in playing phase)
    if (currentPhase === 'playing' && currentRound > 0) {
      newQuery.round = String(currentRound)
    }

    console.log('[SYNC URL] New query', newQuery)
    router.replace({ query: newQuery })
  }

  /**
   * Sync URL with score modal state
   * @param isOpen - Whether the score modal is open
   * @param pairingId - The pairing ID for the score modal
   */
  function syncScoreModal(isOpen: boolean, pairingId: number | null) {
    const newQuery: Record<string, string> = {}

    // Copy existing valid query params
    Object.entries(route.query).forEach(([key, value]) => {
      if (typeof value === 'string' && key !== 'scoreModal') {
        newQuery[key] = value
      }
    })

    if (isOpen && pairingId !== null) {
      newQuery.scoreModal = String(pairingId)
    }

    router.replace({ query: newQuery })
  }

  const scoreModalFromQuery = computed(() => {
    const pairingId = route.query.scoreModal
    return pairingId ? Number(pairingId) : null
  })

  return {
    phaseFromQuery,
    roundFromQuery,
    syncUrl,
    syncScoreModal,
    scoreModalFromQuery,
  }
}
