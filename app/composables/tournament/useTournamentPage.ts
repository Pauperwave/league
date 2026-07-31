// app\composables\tournament\useTournamentPage.ts
import type { Player } from '#shared/utils/types'
import type { TournamentUpdatePayload } from '~/components/tournament/modal/TournamentFormModal.vue'
import type { PaymentMethod } from '~/composables/tournament/useWaitingListFlags'
import { useTournamentUrl } from './useTournamentUrl'

export function useTournamentPage() {
  const route = useRoute()
  const toast = useToast()
  const { t } = useI18n()

  const leagueId = parseInt(route.params.leagueId as string)
  const tournamentId = parseInt(route.params.tournamentId as string)

  // URL management
  const { phaseFromQuery, roundFromQuery, syncUrl } = useTournamentUrl()

  const tournamentStore = useTournamentStore()
  const { calculateTables, buildPreviewTables, formatTableEstimate } = useTableCalculator()
  const queryCache = useQueryCache()

  // Colada caches (ADR-015): players, waitroom, events list, standings,
  // pairing history — all SSR-prefetched, refreshed after lifecycle writes.
  const { data: players } = usePlayersQuery()
  const {
    waitingPlayers,
    waitroomEntries,
    isLoading: waitroomLoading,
    refetch: refreshWaitroom,
  } = useWaitroom(tournamentId)
  const { registerPlayers, unregisterPlayers } = useWaitroomMutations(tournamentId)
  const { updateTournament: updateTournamentMutation } = useTournamentMutations()
  const { data: eventsData, isLoading: eventsLoading, refetch: refreshEventsQuery } = useEventsQuery(leagueId)
  const { data: standingsData, refetch: refreshStandingsQuery } = useEventStandingsQuery(tournamentId)
  const { data: pairingHistoryData } = usePairingHistoryQuery(tournamentId)
  const { data: registrationsData } = useTournamentRegistrationsQuery(tournamentId)
  const { data: leagueTable3CountsData } = useLeagueTable3CountsQuery(leagueId, tournamentId)

  // Colada resolves the league from the cached list (SSR-prefetched) — no
  // store, no manual fetch fallback (ADR-015).
  const { league: currentLeague } = useLeagueById(leagueId)

  // Keep the lifecycle store's currentTournament in sync with the events list —
  // successor of the sync the store's fetchEvents used to do. Lifecycle
  // actions overwrite it with their (fresher) server response right after.
  watch(eventsData, (list) => {
    const found = list?.find(e => e.tournament_id === tournamentId)
    if (found) tournamentStore.setCurrentTournament(found)
  }, { immediate: true })

  const currentTournament = computed(() => tournamentStore.currentTournament)
  const currentRound = computed(() => currentTournament.value?.tournament_current_round ?? 0)
  const totalRounds = computed(() => currentTournament.value?.tournament_round_number ?? 0)

  // Single source of truth for tournament state
  const tournamentStatus = computed<'registration' | 'playing' | 'ended'>(() => {
    if (tournamentStore.isTournamentEnded) return 'ended'
    if (currentTournament.value?.tournament_playing) return 'playing'
    return 'registration'
  })

  const canStartTournament = computed(() => {
    const count = waitingPlayers.value.length
    return count >= 3 && count !== 5
  })

  // Determine current phase from event state (alias for tournamentStatus)
  const currentPhase = computed(() => tournamentStatus.value)

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
        ? t('tournament.notEnoughPlayers')
        : t('tournament.tooManyForFive')
    }
    return formatTableEstimate(
      result.tables4,
      result.tables3,
      (n, size) => size === 4
        ? t('tournament.tablesOf4', n, { named: { count: n } })
        : t('tournament.tablesOf3', n, { named: { count: n } }),
      t('tournament.tableEstimateConjunction'),
    )
  })

  const previewTables = computed<number[][]>(() => {
    if (tournamentStatus.value === 'registration') {
      return buildPreviewTables([...waitingPlayers.value])
    }
    const activePlayers = (standingsData.value ?? []).map(s => s.player_id)
    return buildPreviewTables(activePlayers)
  })

  function getPlayerName(playerId: number): string {
    const player = players.value?.find((p: Player) => p.player_id === playerId)
    return player ? `${player.player_name} ${player.player_surname}` : t('league.ranking.playerFallback', { id: playerId })
  }

  function getPlayer(playerId: number): Player | undefined {
    return players.value?.find((p: Player) => p.player_id === playerId)
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

  async function removeFromWaitingList(playerIds: number[]) {
    try {
      await unregisterPlayers.mutateAsync(playerIds)
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
      queryCache.invalidateQueries({ key: [...PAIRINGS_KEY, tournamentId] }),
      queryCache.invalidateQueries({ key: [...PAIRING_HISTORY_KEY, tournamentId] }),
    ])
  }

  async function startTournament(playerOrder?: number[], payments?: { playerId: number; paymentMethod: PaymentMethod }[]) {
    if (!canStartTournament.value) return false

    const result = await tournamentStore.startTournament(tournamentId, playerOrder, payments)
    if (!result.success) return false

    await refreshAfterLifecycle()
    return true
  }

  async function nextRound(playerOrder?: number[]) {
    const result = await tournamentStore.nextRound(tournamentId, currentRound.value, playerOrder)
    if (!result.success) return false

    await refreshAfterLifecycle()
    return true
  }

  async function turnBackRound() {
    const result = await tournamentStore.turnBackRound(tournamentId, currentRound.value)
    if (!result.success) return false

    await refreshAfterLifecycle()
    return true
  }

  async function updateTournament({ id, data }: TournamentUpdatePayload) {
    try {
      await updateTournamentMutation.mutateAsync({
        id,
        data: {
          tournament_name: data.tournamentName,
          tournament_datetime: data.tournamentDate ?? undefined,
          tournament_round_number: data.numRound,
          tournament_round_duration: data.roundDuration,
        },
      })
      return true
    } catch (err) {
      logError('useTournamentPage', 'updateTournament failed:', err)
      return false
    }
  }

  async function navigateToScore(pairingId: number, playerId: number, tableId: number) {
    await navigateTo({
      path: `/league/${leagueId}/tournament/${tournamentId}/round/${currentRound.value}/score`,
      query: {
        pairingId: String(pairingId),
        playerId: String(playerId),
        tableId: String(tableId),
      },
    })
  }

  // ── Viewed round state (for viewing past round results without changing event state) ──
  const viewedRound = ref<number | null>(null)
  // True while showing the read-only past-registration table (player,
  // registration time, payment method) — mutually exclusive with viewedRound.
  const viewingRegistration = ref(false)

  // advance-round.post.ts sets tournament_current_round to round_number + 1
  // the moment a tournament ends (its "one past the last round" convention —
  // verified against real data, every ended tournament has current_round =
  // round_number + 1) — so currentRound is NOT the last playable round once
  // ended. lastPlayableRound corrects for that everywhere "the last round"
  // is meant, without changing currentRound's own DB-accurate meaning.
  const lastPlayableRound = computed(() => tournamentStatus.value === 'ended' ? totalRounds.value : currentRound.value)

  const isViewingPastRound = computed(() => viewedRound.value !== null && viewedRound.value < lastPlayableRound.value)

  // Once a tournament has ended, its last round is no longer "current" in the
  // playing sense — viewing it is how an admin corrects a score/kill entry
  // mistake in place, without the destructive turn-back-round delete+regenerate
  // flow. Distinct from isViewingPastRound (always readonly).
  const isCorrectingLastRound = computed(() => tournamentStatus.value === 'ended' && viewedRound.value === lastPlayableRound.value)

  // Two instances of the pairings query: the current round (live-standings
  // input) and the displayed round (past-round viewing). When the keys match
  // they share one cache entry; setting viewedRound refetches by key change.
  const { data: pairingsData } = usePairingsQuery(tournamentId, () => currentRound.value)
  const { data: displayedPairingsData, refetch: refreshDisplayedPairings } = usePairingsQuery(tournamentId, () => viewedRound.value ?? currentRound.value)

  function viewRound(round: number) {
    // While playing, clicking the current round again means "leave the past-round
    // preview". Once ended, the "current" round is the one being corrected, so
    // viewing it must stick instead of clearing back to null.
    const leavingView = round === currentRound.value && tournamentStatus.value !== 'ended'
    viewedRound.value = leavingView ? null : round
    viewingRegistration.value = false
  }

  function viewRegistration() {
    viewingRegistration.value = true
    viewedRound.value = null
  }

  function clearViewedRound() {
    viewedRound.value = null
    viewingRegistration.value = false
  }

  const pairings = computed(() => pairingsData.value ?? [])
  const effectivePairings = computed(() => displayedPairingsData.value ?? [])

  const loading = computed(() => tournamentStore.loading || waitroomLoading.value || eventsLoading.value)

  return {
    leagueId,
    tournamentId,
    currentLeague,
    currentTournament,
    currentRound,
    totalRounds,
    tournamentStatus,
    canStartTournament,
    currentPhase,
    phaseFromQuery,
    roundFromQuery,
    waitingPlayers,
    waitroomEntries,
    tableEstimate,
    previewTables,
    pairings,
    displayedPairings: effectivePairings,
    refreshDisplayedPairings,
    viewedRound: computed(() => viewedRound.value),
    isViewingPastRound,
    isCorrectingLastRound,
    viewRound,
    clearViewedRound,
    viewingRegistration: computed(() => viewingRegistration.value),
    viewRegistration,
    registrations: computed(() => registrationsData.value ?? []),
    pairingHistory: computed(() => pairingHistoryData.value ?? []),
    leagueTable3Counts: computed(() => leagueTable3CountsData.value ?? new Map<number, number>()),
    standings: computed(() => standingsData.value ?? []),
    loading,
    players: computed(() => players.value ?? []),
    getPlayerName,
    getPlayer,
    isInWaitingList,
    addToWaitingList,
    removeFromWaitingList,
    startTournament,
    nextRound,
    turnBackRound,
    updateTournament,
    navigateToScore,
  }
}
