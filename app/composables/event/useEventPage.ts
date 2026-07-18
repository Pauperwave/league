// app\composables\event\useEventPage.ts
import type { Player, PairingWithResults } from '#shared/utils/types'
import { useEventUrl } from './useEventUrl'

export function useEventPage() {
  const supabase = useSupabaseClient()
  const route = useRoute()
  const toast = useToast()
  const { t } = useI18n()

  const leagueId = parseInt(route.params.leagueId as string)
  const eventId = parseInt(route.params.eventId as string)

  // URL management
  const { phaseFromQuery, roundFromQuery, syncUrl } = useEventUrl()

  const eventStore = useEventStore()
  const { calculateTables, buildPreviewTables, formatTableEstimate } = useTableCalculator()

  // Colada caches (ADR-015): players list + this event's waitroom
  const { data: players } = usePlayersQuery()
  const {
    waitingPlayers,
    waitroomEntries,
    isLoading: waitroomLoading,
    refresh: refreshWaitroom,
  } = useWaitroom(eventId)
  const { registerPlayers, unregisterPlayers } = useWaitroomMutations(eventId)

  // Colada resolves the league from the cached list (SSR-prefetched) — no
  // store, no manual fetch fallback (ADR-015).
  const { league: currentLeague } = useLeagueById(leagueId)

  // Use eventStore for current event
  const currentEvent = computed(() => {
    // Set current event in store if not already set
    if (!eventStore.currentEvent || eventStore.currentEvent.event_id !== eventId) {
      const event = eventStore.events.find(e => e.event_id === eventId)
      if (event) {
        eventStore.setCurrentEvent(event)
      }
    }
    return eventStore.currentEvent
  })
  const currentRound = computed(() => currentEvent.value?.event_current_round ?? 0)
  const totalRounds = computed(() => currentEvent.value?.event_round_number ?? 0)

  // Single source of truth for event state
  const eventStatus = computed<'registration' | 'playing' | 'ended'>(() => {
    if (eventStore.isEventEnded) return 'ended'
    if (currentEvent.value?.event_playing) return 'playing'
    return 'registration'
  })

  const canStartEvent = computed(() => {
    const count = waitingPlayers.value.length
    return count >= 3 && count !== 5
  })

  // Determine current phase from event state (alias for eventStatus)
  const currentPhase = computed(() => eventStatus.value)

  // Sync URL with current phase and round
  watch([currentPhase, currentRound], ([newPhase, newRound]) => {
    // Don't sync if URL already has correct parameters (prevents overwriting on page reload)
    if (phaseFromQuery.value && phaseFromQuery.value === newPhase && roundFromQuery.value === newRound) {
      return
    }
    syncUrl(newPhase, newRound)
  })

  const tableEstimate = computed(() => {
    const count = waitingPlayers.value.length
    const result = calculateTables(count)
    if (!result.canPlay) {
      return count < 3
        ? t('event.notEnoughPlayers')
        : t('event.tooManyForFive')
    }
    return formatTableEstimate(
      result.tables4,
      result.tables3,
      (n, size) => size === 4
        ? t('event.tablesOf4', n, { named: { count: n } })
        : t('event.tablesOf3', n, { named: { count: n } }),
      t('event.tableEstimateConjunction'),
    )
  })

  const previewTables = computed<number[][]>(() => {
    if (eventStatus.value === 'registration') {
      return buildPreviewTables([...waitingPlayers.value])
    }
    const activePlayers = eventStore.standings.map(s => s.player_id)
    return buildPreviewTables(activePlayers)
  })

  function getPlayerName(playerId: number): string {
    const player = players.value?.find((p: Player) => p.player_id === playerId)
    return player ? `${player.player_name} ${player.player_surname}` : t('league.ranking.playerFallback', { id: playerId })
  }

  function isInWaitingList(playerId: number) {
    return waitingPlayers.value.includes(playerId)
  }

  async function addToWaitingList(playerIds: number[]) {
    try {
      await registerPlayers.mutateAsync(playerIds)
    } catch (err) {
      toast.add({
        title: t('store.player.registerError'),
        description: toErrorMessage(err, t('store.player.registerError')),
        color: 'error'
      })
    }
  }

  async function removeFromWaitingList(playerId: number) {
    try {
      await unregisterPlayers.mutateAsync([playerId])
    } catch (err) {
      toast.add({
        title: t('store.player.registerError'),
        description: toErrorMessage(err, t('store.player.registerError')),
        color: 'error'
      })
    }
  }

  async function startEvent(playerOrder?: number[]) {
    if (!canStartEvent.value) return false

    const result = await eventStore.startEvent(eventId, playerOrder)
    if (!result.success) return false

    await Promise.all([
      eventStore.fetchEvents(leagueId, true),
      eventStore.fetchPairings(eventId, 1),
      eventStore.fetchStandings(eventId),
      refreshWaitroom(),
    ])

    return true
  }

  async function nextRound(playerOrder?: number[]) {
    const result = await eventStore.nextRound(eventId, currentRound.value, playerOrder)
    if (!result.success) return false

    await Promise.all([
      eventStore.fetchEvents(leagueId, true),
      eventStore.fetchStandings(eventId),
    ])

    const roundToFetch = Math.min(currentRound.value, totalRounds.value)
    if (roundToFetch > 0) {
      await eventStore.fetchPairings(eventId, roundToFetch)
    }

    return true
  }

  async function turnBackRound() {
    const result = await eventStore.turnBackRound(eventId, currentRound.value, leagueId)
    if (!result.success) return false

    await Promise.all([
      eventStore.fetchEvents(leagueId, true),
      eventStore.fetchStandings(eventId),
      refreshWaitroom(),
    ])

    // Only fetch pairings if we're still in playing phase (not back to registration)
    if (eventStatus.value === 'playing' && currentRound.value > 0) {
      const roundToFetch = Math.min(currentRound.value, totalRounds.value)
      await eventStore.fetchPairings(eventId, roundToFetch)
    }

    return true
  }

  async function updateEvent({ id, data }: { id: number; data: { eventName: string; eventDate: string | null; numRound: number; roundDuration: number } }) {
    const result = await eventStore.updateEvent(id, {
      event_name: data.eventName,
      event_datetime: data.eventDate ?? undefined,
      event_round_number: data.numRound,
      event_round_duration: data.roundDuration,
    })
    if (!result.success) {
      logError('useEventPage', 'updateEvent failed:', result.error)
      return false
    }
    await eventStore.fetchEvents(leagueId, true)
    return true
  }

  async function navigateToScore(pairingId: number, playerId: number, tableId: number) {
    await navigateTo({
      path: `/league/${leagueId}/event/${eventId}/round/${currentRound.value}/score`,
      query: {
        pairingId: String(pairingId),
        playerId: String(playerId),
        tableId: String(tableId),
      },
    })
  }

  async function refreshWaiting() {
    await refreshWaitroom()
    return waitingPlayers.value
  }

  async function refreshStandings() {
    await eventStore.fetchStandings(eventId)
    return eventStore.standings
  }

  async function refreshPairingHistory() {
    await eventStore.fetchPairingHistory(eventId)
    return eventStore.pairingHistory
  }

  async function refreshEvents() {
    await eventStore.fetchEvents(leagueId)
    return eventStore.events
  }

  // ── Viewed round state (for viewing past round results without changing event state) ──
  const viewedRound = ref<number | null>(null)
  const viewedPairings = ref<PairingWithResults[]>([])

  const isViewingPastRound = computed(() => viewedRound.value !== null && viewedRound.value < currentRound.value)

  async function viewRound(round: number) {
    if (round === currentRound.value) {
      clearViewedRound()
      return
    }
    try {
      const data = await fetchPairingsWithResults(supabase, eventId, round)
      viewedRound.value = round
      viewedPairings.value = data
    }
    catch (err) {
      console.error('[useEventPage] viewRound error:', err)
    }
  }

  function clearViewedRound() {
    viewedRound.value = null
    viewedPairings.value = []
  }

  const effectivePairings = computed(() => {
    if (isViewingPastRound.value) {
      return viewedPairings.value
    }
    return eventStore.pairings
  })

  const loading = computed(() => eventStore.loading || waitroomLoading.value)

  return {
    leagueId,
    eventId,
    currentLeague,
    currentEvent,
    currentRound,
    totalRounds,
    eventStatus,
    canStartEvent,
    currentPhase,
    phaseFromQuery,
    roundFromQuery,
    waitingPlayers,
    waitroomEntries,
    tableEstimate,
    previewTables,
    pairings: computed(() => eventStore.pairings),
    displayedPairings: effectivePairings,
    viewedRound: computed(() => viewedRound.value),
    isViewingPastRound,
    viewRound,
    clearViewedRound,
    pairingHistory: computed(() => eventStore.pairingHistory),
    standings: computed(() => eventStore.standings),
    loading,
    players: computed(() => players.value ?? []),
    getPlayerName,
    isInWaitingList,
    addToWaitingList,
    removeFromWaitingList,
    startEvent,
    nextRound,
    turnBackRound,
    updateEvent,
    navigateToScore,
    refreshWaiting,
    refreshStandings,
    refreshPairingHistory,
    refreshEvents,
  }
}
