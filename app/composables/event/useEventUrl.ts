// app\composables\event\useEventUrl.ts

/**
 * Composable for bidirectional sync between URL query params and event page state.
 *
 * All sync functions use `router.replace` (not `push`) to avoid polluting history.
 * Unknown params are preserved during sync.
 */
export function useEventUrl() {
  const route = useRoute()
  const router = useRouter()

  // ─── Query Readers ────────────────────────────────────────────────────────────

  const phaseFromQuery = computed(() => route.query.phase as string | undefined)

  const roundFromQuery = computed(() => {
    const round = route.query.round
    return round ? parseInt(round as string) || null : null
  })

  const previewFromQuery = computed(() => route.query.preview === '1')

  const scoreModalFromQuery = computed(() => {
    const id = route.query.scoreModal
    return id ? Number(id) : null
  })

  const killModalFromQuery = computed(() => {
    const id = route.query.killModal
    return id ? Number(id) : null
  })

  const votesModalFromQuery = computed(() => {
    const id = route.query.votesModal
    return id ? Number(id) : null
  })

  const commanderModalFromQuery = computed(() => {
    const id = route.query.commanderModal
    return id ? Number(id) : null
  })

  // ─── Generic Query Param Helper ───────────────────────────────────────────────

  /**
   * Set or remove a single query param while preserving all others.
   */
  function setQueryParam(key: string, value: string | null) {
    const newQuery: Record<string, string> = {}

    // Copy existing params except the one being set
    Object.entries(route.query).forEach(([k, v]) => {
      if (typeof v === 'string' && k !== key) {
        newQuery[k] = v
      }
    })

    if (value !== null) {
      newQuery[key] = value
    }

    router.replace({ query: newQuery })
  }

  // ─── Sync Functions ───────────────────────────────────────────────────────────

  /**
   * Sync URL with current phase and round.
   * Strips modal params so switching phase closes any open modal.
   */
  function syncUrl(currentPhase: 'registration' | 'playing' | 'ended', currentRound: number) {
    const newQuery: Record<string, string> = {}

    // Preserve non-conflicting params
    Object.entries(route.query).forEach(([key, value]) => {
      if (typeof value === 'string'
        && key !== 'phase'
        && key !== 'round'
        && key !== 'scoreModal'
        && key !== 'killModal'
        && key !== 'votesModal'
        && key !== 'commanderModal') {
        newQuery[key] = value
      }
    })

    newQuery.phase = currentPhase

    if (currentPhase === 'playing' && currentRound > 0) {
      newQuery.round = String(currentRound)
    }

    router.replace({ query: newQuery })
  }

  function syncPreview(isOpen: boolean) {
    setQueryParam('preview', isOpen ? '1' : null)
  }

  function syncScoreModal(isOpen: boolean, pairingId: number | null) {
    setQueryParam('scoreModal', isOpen && pairingId !== null ? String(pairingId) : null)
  }

  function syncKillModal(isOpen: boolean, tableId: number | null) {
    setQueryParam('killModal', isOpen && tableId !== null ? String(tableId) : null)
  }

  function syncVotesModal(isOpen: boolean, playerId: number | null) {
    setQueryParam('votesModal', isOpen && playerId !== null ? String(playerId) : null)
  }

  function syncCommanderModal(isOpen: boolean, playerId: number | null) {
    setQueryParam('commanderModal', isOpen && playerId !== null ? String(playerId) : null)
  }

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
