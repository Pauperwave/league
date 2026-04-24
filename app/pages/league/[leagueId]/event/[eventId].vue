<!-- app\pages\league\[leagueId]\event\[eventId].vue -->
<script setup lang="ts">
import type { Player, NewPlayer, Seat, TournamentPlayer, TournamentTable, Kill } from '#shared/utils/types'
import type { PairingHistoryEntry, PairingPlayer } from '~/composables/events/pairing/pairingOptimizer'

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
  eventStatus,
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
  updateEvent,
  refreshWaiting,
  refreshStandings,
  refreshPairingHistory,
  pairingHistory,
  loading,
  previewTables,
} = useEventPage()

const { syncUrl, phaseFromQuery, roundFromQuery, syncScoreModal, scoreModalFromQuery } = useEventUrl()

console.log('[PAGE LOAD] Initial state', {
  eventStatus: eventStatus.value,
  currentRound: currentRound.value,
  phaseFromQuery: phaseFromQuery.value,
  roundFromQuery: roundFromQuery.value,
})

// Run data fetching in parallel instead of sequentially
await Promise.all([
  useAsyncData(`waiting-${eventId}`, refreshWaiting),
  useAsyncData(`event-standings-${eventId}`, refreshStandings),
  useAsyncData(`event-pairing-history-${eventId}`, refreshPairingHistory),
])

console.log('[PAGE LOAD] After data fetch', {
  eventStatus: eventStatus.value,
  currentRound: currentRound.value,
  phaseFromQuery: phaseFromQuery.value,
  roundFromQuery: roundFromQuery.value,
})

// Load pairings for current round if event is already in playing phase
if (eventStatus.value === 'playing' && currentRound.value > 0) {
  const eventStore = useEventStore()
  await eventStore.fetchPairings(eventId, currentRound.value)
  console.log('[PAGE LOAD] Pairings loaded for round', currentRound.value)
}

// Sync URL with current event state after data is loaded
// Only sync if URL doesn't have correct parameters (e.g., when navigating from league page)
// This prevents overwriting correct parameters on page reload
console.log('[PAGE LOAD] Checking if sync needed', {
  phaseFromQuery: phaseFromQuery.value,
  eventStatus: eventStatus.value,
  shouldSync: phaseFromQuery.value !== 'preview' && phaseFromQuery.value !== eventStatus.value,
})

if (phaseFromQuery.value !== 'preview' && phaseFromQuery.value !== eventStatus.value) {
  console.log('[PAGE LOAD] Syncing URL manually', { eventStatus: eventStatus.value, currentRound: currentRound.value })
  syncUrl(eventStatus.value, currentRound.value)
} else {
  console.log('[PAGE LOAD] Skipping manual sync')
}

const showEventEditModal = ref(false)
const showNextRoundModal = ref(false)
const showStartPreviewModal = ref(phaseFromQuery.value === 'preview')
const showPlayerSearchModal = ref(false)
const showCreatePlayerModal = ref(false)
const playerToEdit = ref<Player | null>(null)

// Score modal state
const showScoreModal = ref(false)
const selectedPairingId = ref<number | null>(null)
const selectedTableIndex = ref<number | null>(null)

// Commander modal state
const showCommanderModal = ref(false)
const selectedPlayerId = ref<number | null>(null)

// Scores modal state
const showScoresModal = ref(false)
const selectedScoresPairingId = ref<number | null>(null)

// Votes modal state
const showVotesModal = ref(false)
const selectedVotesPlayerId = ref<number | null>(null)

// Rankings state: pairingId -> array of playerIds in ranking order
const rankingsStore = useRankingsStore()

// Commanders state
const commandersStore = useCommandersStore()

// Kills state
const killsStore = useKillsStore()

// Votes state
const votesStore = useVotesStore()

// Get players at the same table as selected player for votes modal
const tablePlayersForVotes = computed(() => {
  if (!selectedVotesPlayerId.value) return []
  const pairing = pairings.value.find(p =>
    [p.pairing_player1_id, p.pairing_player2_id, p.pairing_player3_id, p.pairing_player4_id]
      .includes(selectedVotesPlayerId.value!)
  )
  if (!pairing) return []
  const playerIds = [pairing.pairing_player1_id, pairing.pairing_player2_id, pairing.pairing_player3_id, pairing.pairing_player4_id]
    .filter((id): id is number => !!id)
  return tournamentPlayers.value.filter(p => playerIds.includes(p.id) && p.id !== selectedVotesPlayerId.value)
})

watch(showStartPreviewModal, (isOpen) => {
  if (isOpen) {
    syncUrl('preview', currentRound.value)
  } else {
    // Return to actual event phase
    if (eventStatus.value === 'registration') syncUrl('registration', currentRound.value)
    else if (eventStatus.value === 'playing') syncUrl('playing', currentRound.value)
    else if (eventStatus.value === 'ended') syncUrl('ended', currentRound.value)
  }
})

watch(phaseFromQuery, (phase) => {
  if (phase === 'preview') {
    showStartPreviewModal.value = true
  }
})

watch(showScoreModal, (isOpen) => {
  if (isOpen) {
    syncScoreModal(true, selectedPairingId.value)
  } else {
    console.log('Score modal closed')
    syncScoreModal(false, null)
  }
})

watch(scoreModalFromQuery, (pairingId) => {
  if (pairingId !== null && !showScoreModal.value) {
    const pairing = pairings.value.find(p => p.pairing_id === pairingId)
    if (pairing) {
      const index = pairings.value.indexOf(pairing)
      selectedPairingId.value = pairingId
      selectedTableIndex.value = index
      showScoreModal.value = true
    }
  }
})

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

const tournamentPlayers = computed<TournamentPlayer[]>(() =>
  players.value.map(player => ({
    id: player.player_id,
    name: player.player_name,
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

function handleStepChanged(step: string) {
  if (step === 'registration') {
    syncUrl('registration', currentRound.value)
  } else if (step === 'ended') {
    syncUrl('ended', currentRound.value)
  } else if (step.startsWith('round-')) {
    const round = parseInt(step.replace('round-', ''))
    syncUrl('playing', round)
  }
}

function handleOpenScoreModal(pairingId: number, tableIndex: number) {
  selectedPairingId.value = pairingId
  selectedTableIndex.value = tableIndex
  showScoreModal.value = true
}

function handleOpenCommanderModal(playerId: number) {
  selectedPlayerId.value = playerId
  showCommanderModal.value = true
}

function handleOpenScoresModal(pairingId: number) {
  selectedScoresPairingId.value = pairingId
  showScoresModal.value = true
}

function handleOpenVotesModal(playerId: number) {
  selectedVotesPlayerId.value = playerId
  showVotesModal.value = true
}

function handleCommanderSubmit(commander1: string | null) {
  if (selectedPlayerId.value !== null) {
    commandersStore.setCommanders(selectedPlayerId.value, commander1, null)
  }
  showCommanderModal.value = false
}

function handleVotesSubmit(deckVotePlayerId: number | null, playVotePlayerId: number | null) {
  if (selectedVotesPlayerId.value !== null) {
    votesStore.setVotes(selectedVotesPlayerId.value, deckVotePlayerId, playVotePlayerId)
  }
  showVotesModal.value = false
}

function handleResetTable(pairingId: number) {
  const pairing = pairings.value.find(p => p.pairing_id === pairingId)
  if (!pairing) return

  const playerIds = [
    pairing.pairing_player1_id,
    pairing.pairing_player2_id,
    pairing.pairing_player3_id,
    pairing.pairing_player4_id,
  ].filter((id): id is number => id !== null)

  // Reset classifica
  rankingsStore.removeRanking(pairingId)

  // Reset uccisioni per questo tavolo
  const tableKills = killsStore.kills.filter((k) =>
    playerIds.includes(k.killerId) && playerIds.includes(k.victimId)
  )
  tableKills.forEach((kill) => {
    const index = killsStore.kills.findIndex(
      (k) => k.killerId === kill.killerId && k.victimId === kill.victimId
    )
    if (index !== -1) {
      killsStore.kills.splice(index, 1)
    }
  })

  // Reset comandanti per tutti i giocatori del tavolo
  playerIds.forEach((playerId) => {
    commandersStore.removeCommanders(playerId)
  })

  // Reset voti per tutti i giocatori del tavolo
  playerIds.forEach((playerId) => {
    votesStore.removeVotes(playerId)
  })
}

function handleScoreSubmit(ranking: number[], rankingWithRanks: { playerId: number; rank: number }[]) {
  // TODO: Implement score submission logic based on ranking
  console.log('Ranking submitted:', ranking)
  console.log('Ranking with ranks:', rankingWithRanks)
  if (selectedPairingId.value !== null) {
    rankingsStore.setRankingWithRanks(selectedPairingId.value, rankingWithRanks)
  }
  showScoreModal.value = false
}

function handleKillsSubmit(kills: Kill[]) {
  // TODO: Implement kills submission logic
  console.log('Kills submitted:', kills)
  // Per ora solo log, in futuro chiamerà API endpoint
}

function handleCancelRound() {
  // Reset uccisioni
  const killsStore = useKillsStore()
  killsStore.reset()

  // Reset classifiche temporanee
  rankingsStore.reset()

  console.log('Round annullato: dati temporanei resettati')
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
        :event-status="eventStatus"
        :can-start-event="canStartEvent"
        @start="showStartPreviewModal = true"
        @step-changed="handleStepChanged"
        @cancel-round="handleCancelRound"
      >
        <template #content>
          <!-- Registration Phase - Show EventHeaderCard -->
          <EventHeaderCard
            v-if="eventStatus !== 'playing'"
            :event-name="currentEvent?.event_name ?? 'Evento'"
            :event-date="formattedDate"
            :event-status="eventStatus"
            @edit="showEventEditModal = true"
          >
            <div v-if="eventStatus === 'registration'" class="space-y-4">
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

            <EndedEventBadge v-else-if="eventStatus === 'ended'" />
          </EventHeaderCard>

          <!-- Playing Phase - Show PairingsCard (tables) -->
          <PairingsCard
            v-else
            :pairings="pairings"
            :current-round="currentRound"
            :get-player-name="getPlayerName"
            :has-submitted-score="hasSubmittedScore"
            :all-players="tournamentPlayers"
            :rankings="rankingsStore"
            :commanders-store="commandersStore"
            :kills-store="killsStore"
            :votes-store="votesStore"
            @open-score-modal="handleOpenScoreModal"
            @submit-kills="handleKillsSubmit"
            @open-commander-modal="handleOpenCommanderModal"
            @open-scores-modal="handleOpenScoresModal"
            @open-votes-modal="handleOpenVotesModal"
            @reset-table="handleResetTable"
          />
        </template>
      </EventControlPanel>

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

    <UModal
      v-model:open="showScoreModal"
      title="Inserisci classifica"
      :description="`Tavolo ${selectedTableIndex !== null ? selectedTableIndex + 1 : ''}`"
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <TableScoreGrid
          :pairing="selectedPairingId ? pairings.find(p => p.pairing_id === selectedPairingId) ?? null : null"
          :get-player-name="getPlayerName"
          :all-players="players"
          :saved-ranking-with-ranks="selectedPairingId ? rankingsStore.getRankingWithRanks(selectedPairingId) : undefined"
          @submit="handleScoreSubmit"
          @cancel="showScoreModal = false"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="showCommanderModal"
      title="Imposta Comandanti"
      :description="selectedPlayerId ? getPlayerName(selectedPlayerId) : ''"
      :scrollable="true"
      :ui="{
        content: 'w-[calc(100vw-2rem)] max-w-4xl rounded-lg shadow-lg ring ring-default',
        body: 'flex-1 p-4 sm:p-6 min-h-[60vh]'
      }"
    >
      <template #body>
        <CommanderModal
          v-if="selectedPlayerId"
          :player-id="selectedPlayerId"
          :player-name="getPlayerName(selectedPlayerId)"
          :commander1="commandersStore.getCommander1(selectedPlayerId)"
          @submit="handleCommanderSubmit"
          @cancel="showCommanderModal = false"
        />
      </template>

      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton color="neutral" variant="outline" @click="showCommanderModal = false">
            Annulla
          </UButton>
          <UButton color="primary" @click="handleCommanderSubmit(selectedPlayerId ? commandersStore.getCommander1(selectedPlayerId) : null)">
            Salva
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showScoresModal"
      title="Punteggi Tavolo"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <TableScoresModal
          :pairing="selectedScoresPairingId ? pairings.find(p => p.pairing_id === selectedScoresPairingId) ?? null : null"
          :all-players="tournamentPlayers"
          :rankings="rankingsStore"
          :kills-store="killsStore"
          :votes-store="votesStore"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="showVotesModal"
      title="Voti Mazzo e Giocata"
      :description="selectedVotesPlayerId ? getPlayerName(selectedVotesPlayerId) : ''"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #body>
        <DeckPlayVotesModal
          v-if="selectedVotesPlayerId"
          :player-id="selectedVotesPlayerId"
          :player-name="getPlayerName(selectedVotesPlayerId)"
          :deck-vote-player-id="votesStore.getDeckVote(selectedVotesPlayerId)"
          :play-vote-player-id="votesStore.getPlayVote(selectedVotesPlayerId)"
          :other-players="tablePlayersForVotes"
          @submit="handleVotesSubmit"
          @cancel="showVotesModal = false"
        />
      </template>
    </UModal>

    <EventFormModal
      v-model:open="showEventEditModal"
      :event="currentEvent ?? null"
      :league-id="leagueId"
      @update="handleUpdateEvent"
    />
  </div>
</template>
