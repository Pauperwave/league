// league\app\composables\useEventPage.ts
import type { Player } from '#shared/utils/types'
import { useTableCalculator } from './useTableCalculator'
import { usePlayerStore } from '~/stores/players'

export function useEventPage() {
  const route = useRoute()
  const router = useRouter()

  const leagueId = parseInt(route.params.leagueId as string)
  const eventId = parseInt(route.params.eventId as string)

  const leagueStore = useLeagueStore()
  const eventStore = useEventStore()
  const playerStore = usePlayerStore()
  const { calculateTables, formatTableEstimate } = useTableCalculator()

  const { data: players } = usePlayers()
  const { data: events, refresh: refreshEvents } = useEvents(leagueId)

  const currentLeague = computed(() => leagueStore.getLeagueById(leagueId))

  const currentEvent = computed(() => events.value?.find(e => e.event_id === eventId))
  const currentRound = computed(() => currentEvent.value?.event_current_round ?? 0)
  const totalRounds = computed(() => currentEvent.value?.event_round_number ?? 0)
  const isEventEnded = computed(() => currentRound.value > totalRounds.value)
  const isPlaying = computed(() => currentEvent.value?.event_playing ?? false)
  const isRegistrationOpen = computed(() => currentEvent.value?.event_registration_open ?? false)
  const canStartEvent = computed(() => {
    const count = playerStore.waitingPlayers.length
    return count >= 3 && count !== 5
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

  async function startEvent() {
    if (!canStartEvent.value) return
    await eventStore.startEvent(eventId)
    await eventStore.fetchPairings(eventId, 1)
  }

  async function nextRound() {
    await eventStore.fetchPairings(eventId, currentRound.value + 1)
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
    await refreshEvents()
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

  const loading = computed(() => eventStore.loading || playerStore.loading)

  return {
    leagueId,
    eventId,
    currentLeague,
    currentEvent,
    currentRound,
    totalRounds,
    isEventEnded,
    isPlaying,
    isRegistrationOpen,
    canStartEvent,
    waitingPlayers: computed(() => playerStore.waitingPlayers),
    waitroomEntries: computed(() => playerStore.waitroomEntries),
    tableEstimate,
    pairings: computed(() => eventStore.pairings),
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
    updateEvent,
    navigateToScore,
    refreshWaiting,
    refreshStandings,
  }
}
