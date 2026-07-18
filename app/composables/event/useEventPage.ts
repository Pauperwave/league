// app\composables\event\useEventPage.ts
import type { Player } from '#shared/utils/types'
import { useEventUrl } from './useEventUrl'

export function useEventPage() {
  const route = useRoute()
  const toast = useToast()
  const { t } = useI18n()

  const leagueId = parseInt(route.params.leagueId as string)
  const eventId = parseInt(route.params.eventId as string)

  // URL management
  const { phaseFromQuery, roundFromQuery, syncUrl } = useEventUrl()

  const eventStore = useEventStore()
  const { calculateTables, buildPreviewTables, formatTableEstimate } = useTableCalculator()
  const queryCache = useQueryCache()

  // Colada caches (ADR-015): players, waitroom, events list, standings,
  // pairing history — all SSR-prefetched, refreshed after lifecycle writes.
  const { data: players } = usePlayersQuery()
  const {
    waitingPlayers,
    waitroomEntries,
    isLoading: waitroomLoading,
    refresh: refreshWaitroom,
  } = useWaitroom(eventId)
  const { registerPlayers, unregisterPlayers } = useWaitroomMutations(eventId)
  const { data: eventsData, isLoading: eventsLoading, refresh: refreshEventsQuery } = useEventsQuery(leagueId)
  const { data: standingsData, refresh: refreshStandingsQuery } = useEventStandingsQuery(eventId)
  const { data: pairingHistoryData } = usePairingHistoryQuery(eventId)

  // Colada resolves the league from the cached list (SSR-prefetched) — no
  // store, no manual fetch fallback (ADR-015).
  const { league: currentLeague } = useLeagueById(leagueId)

  // Keep the lifecycle store's currentEvent in sync with the events list —
  // successor of the sync the store's fetchEvents used to do. Lifecycle
  // actions overwrite it with their (fresher) server response right after.
  watch(eventsData, (list) => {
    const found = list?.find(e => e.event_id === eventId)
    if (found) eventStore.setCurrentEvent(found)
  }, { immediate: true })

  const currentEvent = computed(() => eventStore.currentEvent)
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
    const activePlayers = (standingsData.value ?? []).map(s => s.player_id)
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

  /** Refetch the read caches a lifecycle transition touches (ADR-015). */
  async function refreshAfterLifecycle() {
    await Promise.all([
      refreshEventsQuery(),
      refreshStandingsQuery(),
      refreshWaitroom(),
      queryCache.invalidateQueries({ key: [...PAIRINGS_KEY, eventId] }),
      queryCache.invalidateQueries({ key: [...PAIRING_HISTORY_KEY, eventId] }),
    ])
  }

  async function startEvent(playerOrder?: number[]) {
    if (!canStartEvent.value) return false

    const result = await eventStore.startEvent(eventId, playerOrder)
    if (!result.success) return false

    await refreshAfterLifecycle()
    return true
  }

  async function nextRound(playerOrder?: number[]) {
    const result = await eventStore.nextRound(eventId, currentRound.value, playerOrder)
    if (!result.success) return false

    await refreshAfterLifecycle()
    return true
  }

  async function turnBackRound() {
    const result = await eventStore.turnBackRound(eventId, currentRound.value)
    if (!result.success) return false

    await refreshAfterLifecycle()
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
    await refreshEventsQuery()
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

  // ── Viewed round state (for viewing past round results without changing event state) ──
  const viewedRound = ref<number | null>(null)

  const isViewingPastRound = computed(() => viewedRound.value !== null && viewedRound.value < currentRound.value)

  // Two instances of the pairings query: the current round (live-standings
  // input) and the displayed round (past-round viewing). When the keys match
  // they share one cache entry; setting viewedRound refetches by key change.
  const { data: pairingsData } = usePairingsQuery(eventId, () => currentRound.value)
  const { data: displayedPairingsData } = usePairingsQuery(eventId, () => viewedRound.value ?? currentRound.value)

  function viewRound(round: number) {
    viewedRound.value = round === currentRound.value ? null : round
  }

  function clearViewedRound() {
    viewedRound.value = null
  }

  const pairings = computed(() => pairingsData.value ?? [])
  const effectivePairings = computed(() => displayedPairingsData.value ?? [])

  const loading = computed(() => eventStore.loading || waitroomLoading.value || eventsLoading.value)

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
    pairings,
    displayedPairings: effectivePairings,
    viewedRound: computed(() => viewedRound.value),
    isViewingPastRound,
    viewRound,
    clearViewedRound,
    pairingHistory: computed(() => pairingHistoryData.value ?? []),
    standings: computed(() => standingsData.value ?? []),
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
  }
}
