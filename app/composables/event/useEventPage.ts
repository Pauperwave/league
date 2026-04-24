// league\app\composables\event\useEventPage.ts
import type { Player } from '#shared/utils/types'
import { usePlayerStore } from '~/stores/players'
import { useEventUrl } from './useEventUrl'

export function useEventPage() {
  const route = useRoute()
  const router = useRouter()

  const leagueId = parseInt(route.params.leagueId as string)
  const eventId = parseInt(route.params.eventId as string)

  // URL management
  const { phaseFromQuery, roundFromQuery, syncUrl } = useEventUrl()

  const leagueStore = useLeagueStore()
  const eventStore = useEventStore()
  const playerStore = usePlayerStore()
  const { calculateTables, buildPreviewTables, formatTableEstimate } = useTableCalculator()

  const { data: players } = usePlayers()

  const currentLeague = computed(() => leagueStore.getLeagueById(leagueId))

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
    const count = playerStore.waitingPlayers.length
    return count >= 3 && count !== 5
  })

  // Determine current phase from event state (alias for eventStatus)
  const currentPhase = computed(() => eventStatus.value)

  // Sync URL with current phase and round (but not when in preview mode)
  watch([currentPhase, currentRound], ([newPhase, newRound]) => {
    console.log('[WATCHER] Phase/Round changed', {
      newPhase,
      newRound,
      phaseFromQuery: phaseFromQuery.value,
      roundFromQuery: roundFromQuery.value,
    })
    // Don't sync if URL is in preview mode
    if (phaseFromQuery.value === 'preview') {
      console.log('[WATCHER] Skipping sync - preview mode')
      return
    }
    // Don't sync if URL already has correct parameters (prevents overwriting on page reload)
    if (phaseFromQuery.value && phaseFromQuery.value === newPhase && roundFromQuery.value === newRound) {
      console.log('[WATCHER] Skipping sync - URL already correct')
      return
    }
    console.log('[WATCHER] Syncing URL', { newPhase, newRound })
    syncUrl(newPhase, newRound)
  })

  const tableEstimate = computed(() => {
    const count = playerStore.waitingPlayers.length
    const result = calculateTables(count)
    if (!result.canPlay) {
      return count < 3
        ? 'Servono almeno 3 giocatori'
        : 'Non si può giocare con 5 giocatori'
    }
    return formatTableEstimate(result.tables4, result.tables3)
  })

  const previewTables = computed<number[][]>(() => {
    return buildPreviewTables([...playerStore.waitingPlayers])
  })

  function getPlayerName(playerId: number): string {
    const player = players.value?.find((p: Player) => p.player_id === playerId)
    return player ? `${player.player_name} ${player.player_surname}` : `Player ${playerId}`
  }

  function isInWaitingList(playerId: number) {
    return playerStore.waitingPlayers.includes(playerId)
  }

  function hasSubmittedScore(pairingId: number, playerId: number): boolean {
    const pairing = eventStore.pairings.find(p => p.pairing_id === pairingId)
    return pairing?.round_results?.some(s => s.player_id === playerId) ?? false
  }

  async function addToWaitingList(playerIds: number[]) {
    for (const playerId of playerIds) {
      await playerStore.addToWaitingList(eventId, playerId)
    }
  }

  async function removeFromWaitingList(playerId: number) {
    await playerStore.removeFromWaitingList(eventId, playerId)
  }

  async function startEvent(playerOrder?: number[]) {
    if (!canStartEvent.value) return false

    const result = await eventStore.startEvent(eventId, playerOrder)
    if (!result.success) return false

    await Promise.all([
      eventStore.fetchEvents(leagueId, true),
      eventStore.fetchPairings(eventId, 1),
      eventStore.fetchStandings(eventId),
      playerStore.fetchWaitingPlayers(eventId),
    ])

    return true
  }

  async function nextRound() {
    const result = await eventStore.nextRound(eventId, currentRound.value)
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
      playerStore.fetchWaitingPlayers(eventId),
    ])

    // Only fetch pairings if we're still in playing phase (not back to registration)
    if (eventStatus.value === 'playing' && currentRound.value > 0) {
      const roundToFetch = Math.min(currentRound.value, totalRounds.value)
      await eventStore.fetchPairings(eventId, roundToFetch)
    }

    return true
  }

  async function updateEvent({ id, data }: { id: number; data: { eventName: string; eventDate: string | null; numRound: number } }) {
    const result = await eventStore.updateEvent(id, {
      event_name: data.eventName,
      event_datetime: data.eventDate ?? undefined,
      event_round_number: data.numRound,
    })
    if (!result.success) {
      console.error(result.error)
      return false
    }
    await eventStore.fetchEvents(leagueId, true)
    return true
  }

  function navigateToScore(pairingId: number, playerId: number, tableId: number) {
    router.push(
      `/league/${leagueId}/event/${eventId}/round/${currentRound.value}/score?pairingId=${pairingId}&playerId=${playerId}&tableId=${tableId}`
    )
  }

  async function refreshWaiting() {
    await playerStore.fetchWaitingPlayers(eventId)
    return playerStore.waitingPlayers
  }

  async function refreshStandings() {
    await eventStore.fetchStandings(eventId)
    return eventStore.standings
  }

  async function refreshPairingHistory() {
    await eventStore.fetchPairingHistory(eventId)
    return eventStore.pairingHistory
  }

  const loading = computed(() => eventStore.loading || playerStore.loading)

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
    waitingPlayers: computed(() => playerStore.waitingPlayers),
    waitroomEntries: computed(() => playerStore.waitroomEntries),
    tableEstimate,
    previewTables,
    pairings: computed(() => eventStore.pairings),
    pairingHistory: computed(() => eventStore.pairingHistory),
    standings: computed(() => eventStore.standings),
    loading,
    players: computed(() => players.value ?? []),
    getPlayerName,
    isInWaitingList,
    hasSubmittedScore,
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
  }
}
