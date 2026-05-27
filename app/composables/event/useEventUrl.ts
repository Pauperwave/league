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
   * @param currentPhase - Current event phase ('registration' | 'playing' | 'ended')
   */
  function syncUrl(currentPhase: 'registration' | 'playing' | 'ended', currentRound: number) {
    console.log('[SYNC URL] Called', { currentPhase, currentRound, currentQuery: route.query })
    const newQuery: Record<string, string> = {}

    // Copy existing valid query params
    Object.entries(route.query).forEach(([key, value]) => {
      if (typeof value === 'string' && key !== 'phase' && key !== 'round' && key !== 'scoreModal' && key !== 'killModal' && key !== 'votesModal' && key !== 'commanderModal') {
        newQuery[key] = value
      }
    })

    // Update phase
    newQuery.phase = currentPhase

    // Update round if in playing phase
    if (currentPhase === 'playing' && currentRound > 0) {
      newQuery.round = String(currentRound)
    }

    console.log('[SYNC URL] New query', newQuery)
    router.replace({ query: newQuery })
  }

  /**
   * Sync URL with preview overlay state
   */
  function syncPreview(isOpen: boolean) {
    const newQuery: Record<string, string> = {}
    Object.entries(route.query).forEach(([key, value]) => {
      if (typeof value === 'string' && key !== 'preview') {
        newQuery[key] = value
      }
    })
    if (isOpen) {
      newQuery.preview = '1'
    }
    router.replace({ query: newQuery })
  }

  const previewFromQuery = computed(() => route.query.preview === '1')

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

  function syncKillModal(isOpen: boolean, tableId: number | null) {
    const newQuery: Record<string, string> = {}

    Object.entries(route.query).forEach(([key, value]) => {
      if (typeof value === 'string' && key !== 'killModal') {
        newQuery[key] = value
      }
    })

    if (isOpen && tableId !== null) {
      newQuery.killModal = String(tableId)
    }

    router.replace({ query: newQuery })
  }

  const killModalFromQuery = computed(() => {
    const tableId = route.query.killModal
    return tableId ? Number(tableId) : null
  })

  function syncVotesModal(isOpen: boolean, playerId: number | null) {
    const newQuery: Record<string, string> = {}

    Object.entries(route.query).forEach(([key, value]) => {
      if (typeof value === 'string' && key !== 'votesModal') {
        newQuery[key] = value
      }
    })

    if (isOpen && playerId !== null) {
      newQuery.votesModal = String(playerId)
    }

    router.replace({ query: newQuery })
  }

  const votesModalFromQuery = computed(() => {
    const playerId = route.query.votesModal
    return playerId ? Number(playerId) : null
  })

  function syncCommanderModal(isOpen: boolean, playerId: number | null) {
    const newQuery: Record<string, string> = {}

    Object.entries(route.query).forEach(([key, value]) => {
      if (typeof value === 'string' && key !== 'commanderModal') {
        newQuery[key] = value
      }
    })

    if (isOpen && playerId !== null) {
      newQuery.commanderModal = String(playerId)
    }

    router.replace({ query: newQuery })
  }

  const commanderModalFromQuery = computed(() => {
    const playerId = route.query.commanderModal
    return playerId ? Number(playerId) : null
  })

  return {
    phaseFromQuery,
    roundFromQuery,
    syncUrl,
    syncPreview,
    previewFromQuery,
    syncScoreModal,
    scoreModalFromQuery,
    syncKillModal,
    killModalFromQuery,
    syncVotesModal,
    votesModalFromQuery,
    syncCommanderModal,
    commanderModalFromQuery,
  }
}
