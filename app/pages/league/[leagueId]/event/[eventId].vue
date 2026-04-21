<!-- app\pages\league\[leagueId]\event\[eventId].vue -->
<script setup lang="ts">
import type { Player, NewPlayer, Seat, TournamentPlayer, TournamentTable } from '#shared/utils/types'
import type { PairingHistoryEntry, PairingPlayer } from '~/composables/tables/pairingOptimizer'

type PlayerStatusUpdate = {
  playerId: number
  paid: boolean
  companion: boolean
}

const {
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
  waitingPlayers,
  waitroomEntries,
  pairings,
  standings,
  players,
  tableEstimate,
  getPlayerName,
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
  pairingHistory,
  loading,
  previewTables,
} = useEventPage()

// Run data fetching in parallel instead of sequentially
await Promise.all([
  useAsyncData(`waiting-${eventId}`, refreshWaiting),
  useAsyncData(`event-standings-${eventId}`, refreshStandings),
  useAsyncData(`event-pairing-history-${eventId}`, refreshPairingHistory),
])

const showEventEditModal = ref(false)
const showNextRoundModal = ref(false)
const showStartPreviewModal = ref(false)
const showPlayerSearchModal = ref(false)
const showCreatePlayerModal = ref(false)
const playerToEdit = ref<Player | null>(null)
const previewModalTables = computed<TournamentTable[]>(() =>
  previewTables.value.map((table, tableIndex) => {
    const seats = Array.from({ length: 4 }, (_, seatIndex) => {
      const playerId = table[seatIndex]

      let player: TournamentPlayer | null = null
      if (playerId !== undefined) {
        const playerData = players.value.find(p => p.player_id === playerId)
        player = {
          id: playerId,
          name: getPlayerName(playerId),
          surname: playerData?.player_surname ?? '',
        }
      }

      return {
        id: `table-${tableIndex + 1}-seat-${seatIndex + 1}`,
        player,
      }
    }) as [Seat, Seat, Seat, Seat]

    return {
      id: `table-${tableIndex + 1}`,
      tableNumber: tableIndex + 1,
      seats,
    }
  })
)

const playersForPreview = computed<TournamentPlayer[]>(() =>
  players.value.map(player => ({
    id: player.player_id,
    name: `${player.player_name} ${player.player_surname}`,
    surname: player.player_surname,
  }))
)

const pairingPlayersForScoring = computed<PairingPlayer[]>(() => {
  const table3Counter = new Map<number, number>()

  for (const entry of pairingHistory.value) {
    if (entry.players.length !== 3) continue
    for (const playerId of entry.players) {
      table3Counter.set(playerId, (table3Counter.get(playerId) ?? 0) + 1)
    }
  }

  return standings.value.map((standing) => ({
    id: standing.player_id,
    rank: standing.standing_player_rank ?? 9999,
    score: standing.standing_player_score ?? 0,
    table3Count: table3Counter.get(standing.player_id) ?? 0,
  }))
})

const pairingHistoryForScoring = computed<PairingHistoryEntry[]>(() => pairingHistory.value)

async function confirmStartEvent(playerOrder: number[]) {
  const ok = await startEvent(playerOrder)
  if (ok) showStartPreviewModal.value = false
}

async function confirmNextRound() {
  const ok = await nextRound()
  if (ok) showNextRoundModal.value = false
}

async function handleTurnBackRound() {
  await turnBackRound()
}

async function handleUpdateEvent(payload: Parameters<typeof updateEvent>[0]) {
  const ok = await updateEvent(payload)
  if (ok) showEventEditModal.value = false
}

const playerStore = usePlayerStore()
const toast = useToast()

function handleCreateNewPlayer() {
  playerToEdit.value = null
  showCreatePlayerModal.value = true
}

function handleEditPlayer(playerId: number) {
  const player = players.value.find(p => p.player_id === playerId)
  if (player) {
    playerToEdit.value = player
    showCreatePlayerModal.value = true
  }
}

async function handlePlayerCreate(player: NewPlayer) {
  const result = await playerStore.createPlayer(player)
  if (result?.success && result.data) {
    // Aggiungi automaticamente alla waiting list
    await addToWaitingList([result.data.player_id])
    showCreatePlayerModal.value = false
    toast.add({
      title: 'Giocatore creato',
      description: `${result.data.player_name} ${result.data.player_surname} aggiunto alla lista`,
      color: 'success'
    })
  }
}

async function handlePlayerUpdate(payload: { id: number, data: NewPlayer }) {
  const result = await playerStore.updatePlayer(payload.id, payload.data)
  if (result?.success) {
    showCreatePlayerModal.value = false
    toast.add({
      title: 'Giocatore aggiornato',
      color: 'success'
    })
  }
}

async function handlePlayerSelectFromModal(playerId: number) {
  // Seleziona giocatore esistente dalla ricerca simili
  await addToWaitingList([playerId])
  showCreatePlayerModal.value = false
  toast.add({
    title: 'Giocatore aggiunto',
    description: 'Giocatore esistente aggiunto alla lista d\'attesa',
    color: 'success'
  })
}

function handlePlayerStatusUpdate(payload: PlayerStatusUpdate) {
  // Qui potresti salvare lo stato nel database se necessario
  console.log('Player status updated:', payload)
  // Per ora solo log, ma in futuro potresti voler persistere questi dati
}

async function handleBatchRemove(playerIds: number[]) {
  for (const playerId of playerIds) {
    await removeFromWaitingList(playerId)
  }
}

const formattedDate = computed(() => {
  const dt = currentEvent.value?.event_datetime
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

// Cleaner with Object.fromEntries
const playerNames = computed<Record<number, string>>(() =>
  Object.fromEntries(
    players.value.map(p => [p.player_id, `${p.player_name} ${p.player_surname}`])
  )
)

// Extracted from template to keep it readable
const breadcrumbItems = computed(() => [
  { label: 'Home', to: '/', icon: 'i-lucide-home' },
  { label: 'Leghe', to: '/leagues' },
  { label: currentLeague.value?.name ?? 'Lega', to: `/league/${leagueId}` },
  { label: currentEvent.value?.event_name ?? 'Evento' },
])
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="p-6 pb-0">
      <UBreadcrumb :items="breadcrumbItems" />
    </div>

    <div class="flex flex-col gap-6 p-6">
      <!-- Event Control Panel - Centered at top -->
      <EventControlPanel
        :current-round="currentRound"
        :total-rounds="totalRounds"
        :is-playing="isPlaying"
        :is-event-ended="isEventEnded"
        :is-registration-open="isRegistrationOpen"
        :can-start-event="canStartEvent"
        @start="showStartPreviewModal = true"
      />

      <div class="flex flex-col lg:flex-row gap-6 w-full">

        <!-- Header Card -->
        <EventHeaderCard
          :event-name="currentEvent?.event_name ?? 'Evento'"
          :event-date="formattedDate"
          :is-playing="isPlaying"
          :is-event-ended="isEventEnded"
          :is-registration-open="isRegistrationOpen"
          @edit="showEventEditModal = true"
        >
          <!-- Registration Phase -->
          <div v-if="!isPlaying && isRegistrationOpen" class="space-y-4">

            <WaitingList
              :waiting-players="waitingPlayers"
              :player-names="playerNames"
              :waitroom-entries="waitroomEntries"
              :table-estimate="tableEstimate"
              @update="handlePlayerStatusUpdate"
              @remove="removeFromWaitingList"
              @batch-remove="handleBatchRemove"
              @edit="handleEditPlayer"
              @add-player="showPlayerSearchModal = true"
            />

            <PlayerSearchModal
              v-model:open="showPlayerSearchModal"
              :players="players"
              :waiting-players="waitingPlayers"
              @select="addToWaitingList"
              @create-new="handleCreateNewPlayer"
            />

            <CreatePlayerModal
              v-model:open="showCreatePlayerModal"
              :player="playerToEdit"
              :existing-players="players"
              @create="handlePlayerCreate"
              @update="handlePlayerUpdate"
              @select="handlePlayerSelectFromModal"
            />
          </div>

          <!-- Playing Phase -->
          <div v-else-if="isPlaying && !isEventEnded" class="flex flex-col gap-3">
            <RoundTimer
              v-if="currentEvent?.event_round_duration"
              :duration-minutes="currentEvent.event_round_duration"
              :round="currentRound"
              @expired="toast.add({ title: 'Tempo scaduto!', color: 'warning', icon: 'i-lucide-alarm-clock' })"
            />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-arrow-left"
                loading-auto
                @click="handleTurnBackRound"
              >
                Torna Indietro
              </UButton>
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-arrow-right"
                loading-auto
                @click="showNextRoundModal = true"
              >
                Prossimo Round
              </UButton>
            </div>
          </div>

          <!-- Ended -->
          <EndedEventBadge v-else-if="isEventEnded" />
        </EventHeaderCard>

        <!-- Pairings / Tables -->
        <PairingsCard
          v-if="isPlaying || isEventEnded"
          :pairings="pairings"
          :current-round="currentRound"
          :get-player-name="getPlayerName"
          :has-submitted-score="hasSubmittedScore"
          :on-navigate-to-score="navigateToScore"
        />
      </div>
    </div>

    <!-- Modals -->
    <NextRoundModal
      v-model:open="showNextRoundModal"
      @confirm="confirmNextRound"
    />

    <TablePreviewModal
      v-model:open="showStartPreviewModal"
      :tables="previewModalTables"
      :event-id="eventId"
      :players-for-scoring="pairingPlayersForScoring"
      :history="pairingHistoryForScoring"
      :current-round="Math.max(1, currentRound || 1)"
      :all-players="playersForPreview"
      :loading="loading"
      @confirm="confirmStartEvent"
    />

    <EventFormModal
      v-model:open="showEventEditModal"
      :event="currentEvent ?? null"
      :league-id="leagueId"
      @update="handleUpdateEvent"
    />
  </div>
</template>
