<!-- app\pages\league\[leagueId]\event\[eventId].vue -->
<script setup lang="ts">
import { getPairingPlayerIds } from '#shared/utils/types'
import type { Seat, TournamentPlayer, TournamentTable } from '#shared/utils/types'
import type { PairingHistoryEntry, PairingPlayer } from '~/composables/event-pairing/pairingOptimizer'

const { t } = useI18n()

// ── Types ──────────────────────────────────────────────────────────────────

// Note: PlayerStatusUpdate is emitted by WaitingList but not processed in this page

// ── Composables & Stores ───────────────────────────────────────────────────

const {
  leagueId, eventId, currentLeague, currentEvent, currentRound, totalRounds,
  eventStatus, canStartEvent, waitingPlayers, waitroomEntries, pairings, standings,
  players, tableEstimate, getPlayerName,
  addToWaitingList, removeFromWaitingList, startEvent, nextRound, turnBackRound, updateEvent,
  pairingHistory, loading, previewTables, viewedRound, isViewingPastRound, viewRound, clearViewedRound,
  displayedPairings, refreshDisplayedPairings,
} = useEventPage()

const {
  syncUrl, phaseFromQuery,
  syncPreview, previewFromQuery,
  syncScoreModal, scoreModalFromQuery,
  syncKillModal, killModalFromQuery,
  syncVotesModal, votesModalFromQuery,
  syncCommanderModal, commanderModalFromQuery,
} = useEventUrl()

const {
  showEventEditModal,
  showNextRoundModal,
  showStartPreviewModal,
  showCancelRoundConfirm,
  showEndEventConfirm,
  showKillModal,
  showPlayerSearchModal,
  showCreatePlayerModal,
  playerToEdit,
  showScoreModal,
  selectedPairingId,
  selectedTableIndex,
  showCommanderModal,
  selectedPlayerId,
  selectedCommanderPairingId,
  commanderModalRef,
  showScoresModal,
  selectedScoresPairingId,
  showVotesModal,
  selectedVotesPlayerId,
  selectedVotesPairingId,
  selectedKillPairingId,
} = useEventModals()

const eventStore = useEventStore()
const rankingsStore = useRankingsStore()
const commandersStore = useCommandersStore()
const killsStore = useKillsStore()
const votesStore = useVotesStore()

// Crash insurance: mirror in-progress round entry (rankings/kills/votes/
// commanders) to localStorage and restore it after a refresh mid-round.
useSessionStorePersistence({ eventId, currentRound, rankingsStore, killsStore, commandersStore, votesStore })

const toast = useToast()
const { liveStandings } = useLiveStandings(
  computed(() => currentLeague.value?.ruleset_id),
  eventStatus, pairings, standings,
)

// ── Data Fetching ──────────────────────────────────────────────────────────
// The Colada queries inside useEventPage (events, waitroom, standings,
// pairing history, pairings) SSR-prefetch themselves — no useAsyncData
// orchestration needed anymore (ADR-015).

if (phaseFromQuery.value !== 'previewTables' && phaseFromQuery.value !== eventStatus.value) {
  syncUrl(eventStatus.value, currentRound.value)
}

// ── URL Sync ─────────────────────────────────────────────────────────────

useEventUrlSync({
  syncPreview, syncScoreModal, syncKillModal, syncVotesModal, syncCommanderModal,
  previewFromQuery, scoreModalFromQuery, killModalFromQuery, votesModalFromQuery, commanderModalFromQuery,
  showStartPreviewModal,
  showScoreModal,
  selectedPairingId,
  selectedTableIndex,
  pairings,
  showVotesModal,
  selectedVotesPlayerId,
  selectedVotesPairingId,
  showCommanderModal,
  selectedPlayerId,
  selectedCommanderPairingId,
  showKillModal,
  selectedKillPairingId,
})

// ── Lifecycle Handlers ───────────────────────────────────────────────────

const lifecycle = useEventLifecycle({
  nextRound,
  turnBackRound,
  startEvent,
  updateEvent,
  showNextRoundModal,
  showEndEventConfirm,
  showStartPreviewModal,
  showCancelRoundConfirm,
  showEventEditModal,
  isLastRound: computed(() => eventStatus.value === 'playing' && currentRound.value >= totalRounds.value && totalRounds.value > 0),
  currentRound,
  eventStatus,
  syncUrl,
  killsStore,
  rankingsStore,
  commandersStore,
  votesStore,
})

// ── Player Handlers ──────────────────────────────────────────────────────

const playersHandlers = useEventPlayers({
  addToWaitingList,
  removeFromWaitingList,
  players,
  showCreatePlayerModal,
  showPlayerSearchModal,
  playerToEdit,
  toast,
})

// ── Submit Handlers ────────────────────────────────────────────────────────

const submitHandlers = useEventSubmitHandlers({
  rankingsStore,
  eventStore,
  killsStore,
  commandersStore,
  votesStore,
  toast,
  selectedPairingId,
  selectedPlayerId,
  selectedCommanderPairingId,
  selectedVotesPlayerId,
  selectedVotesPairingId,
  refreshDisplayedPairings,
})

// ── Computed: Advance Check ────────────────────────────────────────────────

const canAdvance = computed(() => {
  if (eventStatus.value !== 'playing' || pairings.value.length === 0) return false

  return pairings.value.every((pairing) => {
    const playerIds = [
      pairing.pairing_player1_id, pairing.pairing_player2_id,
      pairing.pairing_player3_id, pairing.pairing_player4_id,
    ].filter((id): id is number => id !== null)

    if (playerIds.length === 0) return false

    const ranking = rankingsStore.getRankingWithRanks(pairing.pairing_id)
    if (!ranking || ranking.length === 0) return false

    const tableKills = killsStore.kills.filter((k) =>
      playerIds.includes(k.killerId) && playerIds.includes(k.victimId)
    )
    if (tableKills.length === 0) return false

    const allCommandersSet = playerIds.every(id => commandersStore.getCommander1(id) !== null)
    if (!allCommandersSet) return false

    const allVotesSet = playerIds.every(id => votesStore.hasVotes(id) === true)
    if (!allVotesSet) return false

    return true
  })
})

// ── Computed: Tables & Players ─────────────────────────────────────────────

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
      return { id: `table-${tableIndex + 1}-seat-${seatIndex + 1}`, player }
    }) as [Seat, Seat, Seat, Seat]

    return { id: `table-${tableIndex + 1}`, tableNumber: tableIndex + 1, seats }
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

// ── Computed: Selected Players for Modals ──────────────────────────────────

const selectedKillPlayers = computed(() => {
  if (!selectedKillPairingId.value) return []
  const pairing = pairings.value.find(p => p.pairing_id === selectedKillPairingId.value)
  if (!pairing) return []
  const ids = getPairingPlayerIds(pairing)
  return tournamentPlayers.value.filter(p => ids.includes(p.id))
})

const tablePlayersForVotes = computed(() => {
  if (!selectedVotesPlayerId.value) return []
  const pairing = pairings.value.find(p => getPairingPlayerIds(p).includes(selectedVotesPlayerId.value!))
  if (!pairing) return []
  const playerIds = getPairingPlayerIds(pairing)
  return tournamentPlayers.value.filter(p => playerIds.includes(p.id) && p.id !== selectedVotesPlayerId.value)
})

// ── Computed: Rankings & Submissions ───────────────────────────────────────

const rankingsByPairing = computed(() => {
  const entries = new Map<number, number[]>()
  for (const [pairingId, rankingWithRanks] of rankingsStore.rankingsWithRanks.entries()) {
    entries.set(pairingId, rankingWithRanks.map(entry => entry.playerId))
  }
  return entries
})

const submittedByPlayerId = computed<Record<number, boolean>>(() => {
  const hasVotesByPlayerId = new Map<number, boolean>()
  for (const pairing of pairings.value) {
    const playerIds = [
      pairing.pairing_player1_id, pairing.pairing_player2_id,
      pairing.pairing_player3_id, pairing.pairing_player4_id,
    ].filter((id): id is number => id !== null)
    for (const playerId of playerIds) {
      hasVotesByPlayerId.set(playerId, votesStore.hasVotes(playerId))
    }
  }
  return Object.fromEntries(
    buildStandingsSubmissionMap(pairings.value, rankingsByPairing.value, hasVotesByPlayerId).entries(),
  )
})

// ── Computed: UI Text ──────────────────────────────────────────────────────

  const standingsTitle = computed(() => {
    if (eventStatus.value === 'ended') return t('event.standingsTitleFinal')
    if (currentRound.value > 0) return t('event.standingsTitleRound', { round: currentRound.value })
    return t('event.standingsTitleDefault')
  })

  const roundDuration = computed(() => {
    return currentEvent.value?.event_round_duration ?? 75
  })

  function handleTimerExpired() {
    toast.add({
      title: t('event.timerExpiredTitle'),
      description: t('event.timerExpiredDescription', { round: currentRound.value }),
      color: 'warning',
      icon: ICONS.timerOff,
    })
  }

const formattedDate = computed(() => {
  const dt = currentEvent.value?.event_datetime
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })
})

const leagueName = computed(() => currentLeague.value?.name ?? t('league.fallbackName'))
const eventName = computed(() => currentEvent.value?.event_name ?? t('event.fallbackName'))

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('league.breadcrumb'), to: '/leagues' },
  { label: leagueName.value, to: `/league/${leagueId}` },
  { label: eventName.value },
])

const playerNames = computed<Record<number, string>>(() =>
  Object.fromEntries(players.value.map(p => [p.player_id, `${p.player_name} ${p.player_surname}`]))
)

// ── Modal Open Handlers ──────────────────────────────────────────────────

function handleOpenScoreModal(pairingId: number, tableIndex: number) {
  selectedPairingId.value = pairingId
  selectedTableIndex.value = tableIndex
  showScoreModal.value = true
}

function handleOpenCommanderModal(pairingId: number, playerId: number) {
  selectedCommanderPairingId.value = pairingId
  selectedPlayerId.value = playerId
  showCommanderModal.value = true
}

function handleOpenScoresModal(pairingId: number) {
  selectedScoresPairingId.value = pairingId
  showScoresModal.value = true
}

function handleOpenVotesModal(pairingId: number, playerId: number) {
  selectedVotesPairingId.value = pairingId
  selectedVotesPlayerId.value = playerId
  showVotesModal.value = true
}

function handleOpenKillModal(pairingId: number) {
  killsStore.reset()
  selectedKillPairingId.value = pairingId
  showKillModal.value = true
}

// ── Reset / Utility ──────────────────────────────────────────────────────

function handleResetTable(pairingId: number) {
  const pairing = pairings.value.find(p => p.pairing_id === pairingId)
  if (!pairing) return

    const playerIds = getPairingPlayerIds(pairing)

  rankingsStore.removeRanking(pairingId)

  const tableKills = killsStore.kills.filter((k) =>
    playerIds.includes(k.killerId) && playerIds.includes(k.victimId)
  )
  tableKills.forEach((kill) => {
    const index = killsStore.kills.findIndex((k) => k.killerId === kill.killerId && k.victimId === kill.victimId)
    if (index !== -1) killsStore.kills.splice(index, 1)
  })

  playerIds.forEach((playerId) => {
    commandersStore.removeCommanders(playerId)
    votesStore.removeVotes(playerId)
  })
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <!-- Header -->
    <div class="p-6 pb-0 space-y-2">
      <UBreadcrumb :items="breadcrumbItems" />
      <h1 class="text-2xl font-bold">{{ eventName }}</h1>
    </div>

    <!-- Main Content -->
    <div class="flex flex-col gap-6 p-6">
      <EventControlPanel
        :current-round="currentRound"
        :total-rounds="totalRounds"
        :event-status="eventStatus"
        :can-start-event="canStartEvent"
        :can-advance="canAdvance"
        @start="showStartPreviewModal = true"
        @advance="lifecycle.handleAdvance"
        @end="showEndEventConfirm = true"
        @step-changed="lifecycle.handleStepChanged"
        @cancel-round="lifecycle.handleCancelRound"
        @view-round="viewRound"
      >
        <template #content>
          <!-- Viewing Past Round Banner -->
          <div
            v-if="isViewingPastRound"
            class="mb-4 p-4 rounded-lg border bg-elevated border-muted flex items-center justify-between"
          >
            <span class="text-sm font-medium">
              {{ t('event.viewingPastRound', { round: viewedRound }) }}
            </span>
            <UButton
              size="sm"
              color="primary"
              variant="soft"
              :icon="ICONS.reset"
              @click="clearViewedRound"
            >
              {{ t('event.backToCurrentRound') }}
            </UButton>
          </div>

          <!-- Registration / Ended Phase -->
          <EventHeaderCard
            v-if="eventStatus !== 'playing' && !isViewingPastRound"
            :event-name="eventName"
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
                @update="playersHandlers.handlePlayerStatusUpdate"
                @remove="(playerId: number) => removeFromWaitingList([playerId])"
                @batch-remove="playersHandlers.handleBatchRemove"
                @edit="playersHandlers.handleEditPlayer"
                @add-player="showPlayerSearchModal = true"
              />

              <PlayerSearchModal
                v-model:open="showPlayerSearchModal"
                :players="players"
                :waiting-players="waitingPlayers"
                @select="addToWaitingList"
                @create-new="playersHandlers.handleCreateNewPlayer"
              />

              <CreatePlayerModal
                v-model:open="showCreatePlayerModal"
                :player="playerToEdit"
                :existing-players="players"
                @create="playersHandlers.handlePlayerCreate"
                @update="playersHandlers.handlePlayerUpdate"
                @select="playersHandlers.handlePlayerSelectFromModal"
              />
            </div>

            <div v-else-if="eventStatus === 'ended'" class="space-y-2">
              <EndedEventBadge />
              <StandingsCard
                :standings="liveStandings"
                :loading="loading"
              />
            </div>
          </EventHeaderCard>

          <!-- Playing Phase -->
          <div
            v-else
            class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
          >
            <div class="space-y-4">
              <RoundTimer
                v-if="!isViewingPastRound && currentRound > 0"
                :duration-minutes="roundDuration"
                :round="currentRound"
                @expired="handleTimerExpired"
              />
              <PairingsCard
                :pairings="displayedPairings"
                :readonly="isViewingPastRound"
                :all-players="tournamentPlayers"
                @open-score-modal="handleOpenScoreModal"
                @open-commander-modal="handleOpenCommanderModal"
                @open-scores-modal="handleOpenScoresModal"
                @open-votes-modal="handleOpenVotesModal"
                @open-kill-modal="handleOpenKillModal"
                @reset-table="handleResetTable"
                @draw="(pairingId, playerIds) => submitHandlers.handleDrawSubmit(pairingId, playerIds)"
              />
            </div>
            <StandingsCard
              :standings="liveStandings"
              :loading="loading"
              :title="standingsTitle"
              :submitted-by-player-id="submittedByPlayerId"
            />
          </div>
        </template>
      </EventControlPanel>
    </div>

    <!-- ── Modals ─────────────────────────────────────────────────────────── -->

    <NextRoundModal
      v-model:open="showNextRoundModal"
      @confirm="lifecycle.confirmNextRound"
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
      @confirm="lifecycle.handlePreviewConfirm"
    />

    <ConfirmModal
      v-model:open="showCancelRoundConfirm"
      :title="t('event.cancelRound.title')"
      :description="t('event.cancelRound.description')"
      :question="t('event.cancelRound.question')"
      :warning="t('event.cancelRound.warning')"
      :confirm-label="t('event.cancelRound.confirmLabel')"
      :confirm-icon="ICONS.delete"
      :loading="loading"
      @confirm="lifecycle.confirmCancelRound"
    />

    <ConfirmModal
      v-model:open="showEndEventConfirm"
      :title="t('event.endEvent.title')"
      :description="t('event.endEvent.description')"
      :question="t('event.endEvent.question')"
      :warning="t('event.endEvent.warning')"
      :confirm-label="t('event.endEvent.confirmLabel')"
      :confirm-icon="ICONS.flag"
      :loading="loading"
      @confirm="lifecycle.confirmEndEvent"
    />

    <EventScoreModal
      :show-score-modal="showScoreModal"
      :selected-pairing-id="selectedPairingId"
      :selected-table-index="selectedTableIndex"
      :pairings="pairings"
      :all-players="players"
      :rankings-store="rankingsStore"
      @submit="(ranking, rankingWithRanks) => {
        if (submitHandlers.handleScoreSubmit(ranking, rankingWithRanks))
          showScoreModal = false
      }"
      @cancel="showScoreModal = false"
    />

    <EventCommanderModal
      :show-commander-modal="showCommanderModal"
      :selected-player-id="selectedPlayerId"
      :selected-commander-pairing-id="selectedCommanderPairingId"
      :commander-modal-ref="commanderModalRef"
      :get-player-name="getPlayerName"
      :commanders-store="commandersStore"
      @submit="(commander1, commander2) => {
        if (submitHandlers.handleCommanderSubmit(commander1, commander2))
          showCommanderModal = false
      }"
      @cancel="showCommanderModal = false"
    />

    <EventScoresModal
      :show-scores-modal="showScoresModal"
      :selected-scores-pairing-id="selectedScoresPairingId"
      :pairings="pairings"
      :tournament-players="tournamentPlayers"
      :rankings-store="rankingsStore"
      :kills-store="killsStore"
      :votes-store="votesStore"
      @cancel="showScoresModal = false"
    />

    <EventKillModal
      :show-kill-modal="showKillModal"
      :selected-kill-players="selectedKillPlayers"
      :selected-kill-pairing-id="selectedKillPairingId"
      @submit="(kills) => submitHandlers.handleKillsSubmit(selectedKillPairingId!, kills)"
      @close="showKillModal = false"
    />

    <EventVotesModal
      :show-votes-modal="showVotesModal"
      :selected-votes-player-id="selectedVotesPlayerId"
      :get-player-name="getPlayerName"
      :votes-store="votesStore"
      :table-players-for-votes="tablePlayersForVotes"
      @submit="(deckVotePlayerId, playVotePlayerId) => {
        if (submitHandlers.handleVotesSubmit(deckVotePlayerId, playVotePlayerId))
          showVotesModal = false
      }"
      @cancel="showVotesModal = false"
    />

    <EventFormModal
      v-model:open="showEventEditModal"
      :event="currentEvent ?? null"
      :league-id="leagueId"
      @update="lifecycle.handleUpdateEvent"
    />
  </div>
</template>
