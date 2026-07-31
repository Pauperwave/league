<!-- app\pages\league\[leagueId]\tournament\[tournamentId].vue -->
<script setup lang="ts">
import { getPairingPlayerIds } from '#shared/utils/types'
import type { Seat, TablePlayer, PairingTable } from '#shared/utils/types'
import type { PairingHistoryEntry, PairingPlayer } from '~/composables/event-pairing/pairingOptimizer'
import type TournamentStepper from '~/components/tournament/TournamentStepper.vue'

const { t } = useI18n()
const router = useRouter()
const stepper = useTemplateRef<InstanceType<typeof TournamentStepper>>('stepper')

const backToLeagueLogging = useButtonLogging(t('logging.navigation.backToLeague'))

function handleBackToLeague() {
  backToLeagueLogging.logClick()
  router.push(`/league/${leagueId}`)
}

// ── Types ──────────────────────────────────────────────────────────────────

// Note: PlayerStatusUpdate is emitted by WaitingList but not processed in this page

// ── Composables & Stores ───────────────────────────────────────────────────

const {
  leagueId, tournamentId, currentLeague, currentTournament, currentRound, totalRounds,
  tournamentStatus, canStartTournament, waitingPlayers, waitroomEntries, pairings, standings,
  players, tableEstimate, getPlayerName, getPlayer,
  addToWaitingList, removeFromWaitingList, startTournament, nextRound, turnBackRound, updateTournament,
  pairingHistory, leagueTable3Counts, loading, previewTables, viewedRound, isViewingPastRound, isCorrectingLastRound, viewRound, clearViewedRound,
  viewingRegistration, viewRegistration, registrations,
  displayedPairings, refreshDisplayedPairings,
} = useTournamentPage()

// Ruleset for the "Punteggi Tavolo" breakdown (TournamentScoresModal) — rulesets
// are a single shared cache (useRulesetsQuery, ADR-015), find this league's.
const { data: rulesetsData } = useRulesetsQuery()
const currentRuleset = computed(() =>
  rulesetsData.value?.find(r => r.ruleset_id === currentLeague.value?.ruleset_id) ?? null
)

const {
  syncUrl, phaseFromQuery,
  syncPreview, previewFromQuery,
  syncScoreModal, scoreModalFromQuery,
  syncKillModal, killModalFromQuery,
  syncVotesModal, votesModalFromQuery,
  syncCommanderModal, commanderModalFromQuery,
} = useTournamentUrl()

const {
  showTournamentEditModal,
  showNextRoundModal,
  showStartPreviewModal,
  showCancelRoundConfirm,
  showEndTournamentConfirm,
  showKillModal,
  showCreatePlayerModal,
  playerToEdit,
  showScoreModal,
  selectedPairingId,
  selectedTableIndex,
  showCommanderModal,
  selectedPlayerId,
  selectedCommanderPairingId,
  showScoresModal,
  selectedScoresPairingId,
  showVotesModal,
  selectedVotesPlayerId,
  selectedVotesPairingId,
  selectedKillPairingId,
} = useTournamentModals()

const tournamentStore = useTournamentStore()
const rankingsStore = useRankingsStore()
const commandersStore = useCommandersStore()
const killsStore = useKillsStore()
const votesStore = useVotesStore()

// Crash insurance: mirror in-progress round entry (rankings/kills/votes/
// commanders) to localStorage and restore it after a refresh mid-round.
useSessionStorePersistence({ tournamentId, currentRound, rankingsStore, killsStore, commandersStore, votesStore })

const toast = useToast()
const { liveStandings } = useLiveStandings(
  computed(() => currentLeague.value?.ruleset_id),
  tournamentStatus, pairings, standings,
)

// ── Data Fetching ──────────────────────────────────────────────────────────
// The Colada queries inside useTournamentPage (events, waitroom, standings,
// pairing history, pairings) SSR-prefetch themselves — no useAsyncData
// orchestration needed anymore (ADR-015).

if (phaseFromQuery.value !== 'previewTables' && phaseFromQuery.value !== tournamentStatus.value) {
  syncUrl(tournamentStatus.value, currentRound.value)
}

// ── URL Sync ─────────────────────────────────────────────────────────────

useTournamentUrlSync({
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

const lifecycle = useTournamentLifecycle({
  tournamentId,
  nextRound,
  turnBackRound,
  startTournament,
  updateTournament,
  showNextRoundModal,
  showEndTournamentConfirm,
  showStartPreviewModal,
  showCancelRoundConfirm,
  showTournamentEditModal,
  isLastRound: computed(() => tournamentStatus.value === 'playing' && currentRound.value >= totalRounds.value && totalRounds.value > 0),
  currentRound,
  tournamentStatus,
  syncUrl,
  clearViewedRound,
  killsStore,
  rankingsStore,
  commandersStore,
  votesStore,
})

// ── Player Handlers ──────────────────────────────────────────────────────

const playersHandlers = useTournamentPlayers({
  addToWaitingList,
  removeFromWaitingList,
  players,
  showCreatePlayerModal,
  playerToEdit,
  toast,
})

// ── Submit Handlers ────────────────────────────────────────────────────────

const submitHandlers = useTournamentSubmitHandlers({
  rankingsStore,
  tournamentStore,
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

const { isTableComplete } = useTableCompletion(rankingsStore, commandersStore, votesStore)

const canAdvance = computed(() => {
  if (tournamentStatus.value !== 'playing' || pairings.value.length === 0) return false

  return pairings.value.every(pairing => isTableComplete(pairing))
})

// ── Computed: Tables & Players ─────────────────────────────────────────────

const previewModalTables = computed<PairingTable[]>(() =>
  previewTables.value.map((table, tableIndex) => {
    const seats = Array.from({ length: 4 }, (_, seatIndex) => {
      const playerId = table[seatIndex]
      let player: TablePlayer | null = null
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

const playersForPreview = computed<TablePlayer[]>(() =>
  players.value.map(player => ({
    id: player.player_id,
    name: `${player.player_name} ${player.player_surname}`,
    surname: player.player_surname,
  }))
)

const tournamentPlayers = computed<TablePlayer[]>(() =>
  players.value.map(player => ({
    id: player.player_id,
    name: player.player_name,
    surname: player.player_surname,
  }))
)

// "Who's won this table" checklist (BACKLOG #15) — winners derived live from
// rankingsStore, booster hand-out check-off state persisted per event+round.
const winners = useWinners(displayedPairings, tournamentPlayers, rankingsStore)
const { checked: winnersChecked, toggle: toggleWinnerChecked } = useWinnerChecklist(tournamentId, currentRound)

const pairingPlayersForScoring = computed<PairingPlayer[]>(() => {
  // Tonight's rotation (this tournament's own already-played rounds) plus the
  // league's history from every other tournament (BACKLOG #20) — summed, not
  // replaced, so round 1 (which has no rounds of its own yet) still inherits
  // a real signal instead of starting from zero every time.
  const table3Counter = new Map<number, number>(leagueTable3Counts.value)
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
  return tournamentPlayers.value
    .filter(p => playerIds.includes(p.id) && p.id !== selectedVotesPlayerId.value)
    .map(p => ({ ...p, commander1: commandersStore.getCommander1(p.id) }))
})

// ── Computed: Rankings & Submissions ───────────────────────────────────────

const submittedByPlayerId = computed<Record<number, boolean>>(() => {
  const isCompleteByPairing = new Map<number, boolean>()
  for (const pairing of pairings.value) {
    isCompleteByPairing.set(pairing.pairing_id, isTableComplete(pairing))
  }
  return Object.fromEntries(
    buildStandingsSubmissionMap(pairings.value, isCompleteByPairing).entries(),
  )
})

// ── Computed: UI Text ──────────────────────────────────────────────────────

  const standingsTitle = computed(() => {
    if (tournamentStatus.value === 'ended') return t('tournament.standingsTitleFinal')
    if (currentRound.value > 0) return t('tournament.standingsTitleRound', { round: currentRound.value })
    return t('tournament.standingsTitleDefault')
  })

  const roundDuration = computed(() => {
    return currentTournament.value?.tournament_round_duration ?? 75
  })

  function handleTimerExpired() {
    toast.add({
      title: t('tournament.timerExpiredTitle'),
      description: t('tournament.timerExpiredDescription', { round: currentRound.value }),
      color: 'warning',
      icon: ICONS.timerOff,
    })
  }

const formattedDate = computed(() => {
  const dt = currentTournament.value?.tournament_datetime
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })
})

const leagueName = computed(() => currentLeague.value?.name ?? t('league.fallbackName'))
const eventName = computed(() => currentTournament.value?.tournament_name ?? t('tournament.fallbackName'))

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('league.breadcrumb'), to: '/leagues' },
  { label: leagueName.value, to: `/league/${leagueId}` },
  { label: eventName.value },
])

// TournamentActionBar and TournamentStepper are now siblings (extracted from the old
// EventControlPanel so the actions can live in their own row under the
// header — see ADR/session 2026-07-26) — the page has to coordinate the
// stepper's immediate visual step-back itself instead of that living inside
// one wrapper component.
function handleCancelRoundClick() {
  lifecycle.handleCancelRound()
  stepper.value?.prev()
}

// Non-destructive counterpart to "Annulla round" for an ended tournament:
// opens the last round's pairings for editing (score/kill/commander/votes)
// without deleting or regenerating anything. currentRound is NOT the last
// playable round once ended (advance-round.post.ts leaves it at
// totalRounds + 1) — totalRounds is the real last round to correct.
function handleCorrectLastRound() {
  viewRound(totalRounds.value)
}

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

// True while the commander modal was opened FROM the votes modal
// (CommanderVoteCard's "Assegna comandante", when a voted-on player has no
// commander yet) — reopens the votes modal once the commander modal closes
// (submit or cancel) instead of leaving the admin stranded on it.
const pendingVotesReopen = ref(false)

function handleAssignCommanderFromVotes(playerId: number) {
  if (selectedVotesPairingId.value === null) return
  pendingVotesReopen.value = true
  showVotesModal.value = false
  handleOpenCommanderModal(selectedVotesPairingId.value, playerId)
}

function handleCommanderModalClosed() {
  showCommanderModal.value = false
  if (pendingVotesReopen.value) {
    pendingVotesReopen.value = false
    showVotesModal.value = true
  }
}

// Every player seated anywhere in the current round — same list
// PairingsCard.vue prefetches with, so this resolves from cache instead of
// firing its own request (see useCommanderUsageQuery).
const commanderModalTablePlayerIds = computed(() => pairings.value.flatMap(getPairingPlayerIds))

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

/** Resets a table's local session state AND persists the clear server-side
 *  (`tournamentStore.resetPairing`, kills+ranking+commander+votes) — without the
 *  server call, `round_results` kept the previously-submitted values, so
 *  e.g. "Uccisioni" kept showing as reviewed after a reset even though the
 *  local stores were cleared. */
async function handleResetTable(pairingId: number) {
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

  const result = await tournamentStore.resetPairing(pairingId)
  if (!result.success) {
    toast.add({ title: t('deck.toast.errorTitle'), description: result.error, color: 'error' })
    return
  }
  await refreshDisplayedPairings()
}

/** Undoes a "Patta" declaration: clears the ranking/kills it set, both
 *  locally and server-side (round_results back to unset), restoring the
 *  table to the empty state it was in before the draw — Patta can only be
 *  declared on an empty table, so that's always the correct prior state.
 *  Leaves commanders/votes untouched (draw never touched those either). */
async function handleUndrawTable(pairingId: number) {
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

  const result = await tournamentStore.undrawPairing(pairingId)
  if (!result.success) {
    toast.add({ title: t('deck.toast.errorTitle'), description: result.error, color: 'error' })
    return
  }
  toast.add({ title: t('tournament.undrawnTitle'), color: 'success' })
  await refreshDisplayedPairings()
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <!-- Header -->
    <div class="p-6 pb-0 space-y-2">
      <UBreadcrumb :items="breadcrumbItems" />
      <UButton
        color="neutral"
        :icon="ICONS.back"
        :aria-label="t('league.backAriaLabel')"
        @click="handleBackToLeague"
      >
        {{ t('common.back') }}
      </UButton>
      <TournamentHeaderCard
        v-if="tournamentStatus !== 'playing' && !isViewingPastRound"
        :tournament-name="eventName"
        :tournament-date="formattedDate"
        :tournament-status="tournamentStatus"
        @edit="showTournamentEditModal = true"
      />
      <h1 v-else class="text-2xl font-bold">{{ eventName }}</h1>
    </div>

    <!-- Main Content -->
    <div class="flex flex-col gap-6 p-6">
      <TournamentActionBar
        :current-round="currentRound"
        :total-rounds="totalRounds"
        :tournament-status="tournamentStatus"
        :can-start-tournament="canStartTournament"
        :can-advance="canAdvance"
        @start="showStartPreviewModal = true"
        @advance="lifecycle.handleAdvance"
        @end="showEndTournamentConfirm = true"
        @cancel-round="handleCancelRoundClick"
        @correct-last-round="handleCorrectLastRound"
      />

      <TournamentStepper
        ref="stepper"
        :current-round="currentRound"
        :total-rounds="totalRounds"
        :tournament-status="tournamentStatus"
        :viewed-round="viewedRound"
        :viewing-registration="viewingRegistration"
        @step-changed="lifecycle.handleStepChanged"
        @view-round="viewRound"
        @view-registration="viewRegistration"
      >
        <template #content>
          <!-- Viewing Past Round / Correcting Last Round / Viewing Registration Banner -->
          <div
            v-if="isViewingPastRound || isCorrectingLastRound || viewingRegistration"
            class="mb-4 p-4 rounded-lg border bg-elevated border-muted flex items-center justify-between"
          >
            <span class="text-sm font-medium">
              {{ viewingRegistration
                ? t('tournament.viewingRegistration')
                : isCorrectingLastRound
                  ? t('tournament.correctingLastRound', { round: viewedRound })
                  : t('tournament.viewingPastRound', { round: viewedRound }) }}
            </span>
            <UButton
              size="sm"
              color="primary"
              variant="soft"
              :icon="ICONS.reset"
              @click="clearViewedRound"
            >
              {{ isCorrectingLastRound
                ? t('tournament.backToEndedTournament')
                : viewingRegistration
                  ? t('tournament.backToTournament')
                  : t('tournament.backToCurrentRound') }}
            </UButton>
          </div>

          <!-- Registration Preview (past registration snapshot, read-only) -->
          <div v-if="viewingRegistration">
            <TournamentRegistrationTable
              :registrations="registrations"
              :players="players"
            />
          </div>

          <!-- Registration / Ended Phase -->
          <div v-else-if="tournamentStatus !== 'playing' && !isViewingPastRound && !isCorrectingLastRound">
            <div v-if="tournamentStatus === 'registration'" class="space-y-4">
              <WaitingList
                :waiting-players="waitingPlayers"
                :players="players"
                :tournament-id="tournamentId"
                :waitroom-entries="waitroomEntries"
                :table-estimate="tableEstimate"
                @update="playersHandlers.handlePlayerStatusUpdate"
                @remove="(playerId: number) => removeFromWaitingList([playerId])"
                @batch-remove="playersHandlers.handleBatchRemove"
                @edit="playersHandlers.handleEditPlayer"
                @select="addToWaitingList"
                @create-new="playersHandlers.handleCreateNewPlayer"
              />

              <CreatePlayerModal
                v-model:open="showCreatePlayerModal"
                :player="playerToEdit"
                :existing-players="players"
                context="tournament"
                @create="playersHandlers.handlePlayerCreate"
                @update="playersHandlers.handlePlayerUpdate"
                @select="playersHandlers.handlePlayerSelectFromModal"
              />
            </div>

            <div v-else-if="tournamentStatus === 'ended'" class="space-y-2">
              <EndedTournamentBadge />
              <StandingsCard
                :standings="liveStandings"
                :loading="loading"
              />
            </div>
          </div>

          <!-- Playing Phase -->
          <div
            v-else
            class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
          >
            <div class="space-y-4">
              <RoundTimer
                v-if="!isViewingPastRound && !isCorrectingLastRound && currentRound > 0"
                :key="currentRound"
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
                @undraw="handleUndrawTable"
                @refresh-pairings="refreshDisplayedPairings"
              />
            </div>
            <div class="space-y-4">
              <RoundStatusCard
                v-if="!isViewingPastRound && !isCorrectingLastRound"
                :pairings="displayedPairings"
                :tournament-players="tournamentPlayers"
                @open-score-modal="handleOpenScoreModal"
                @open-kill-modal="handleOpenKillModal"
                @open-commander-modal="handleOpenCommanderModal"
                @open-votes-modal="handleOpenVotesModal"
              />
              <WinnerChecklist
                v-if="!isViewingPastRound && !isCorrectingLastRound"
                :winners="winners"
                :checked="winnersChecked"
                @toggle="toggleWinnerChecked"
              />
              <StandingsCard
                :standings="liveStandings"
                :loading="loading"
                :title="standingsTitle"
                :submitted-by-player-id="submittedByPlayerId"
              />
            </div>
          </div>
        </template>
      </TournamentStepper>
    </div>

    <!-- ── Modals ─────────────────────────────────────────────────────────── -->

    <NextRoundModal
      v-model:open="showNextRoundModal"
      @confirm="lifecycle.confirmNextRound"
    />

    <TablePreviewModal
      v-model:open="showStartPreviewModal"
      :tables="previewModalTables"
      :tournament-id="tournamentId"
      :players-for-scoring="pairingPlayersForScoring"
      :history="pairingHistoryForScoring"
      :current-round="Math.max(1, currentRound || 1)"
      :all-players="playersForPreview"
      :loading="loading"
      @confirm="lifecycle.handlePreviewConfirm"
    />

    <ConfirmModal
      v-model:open="showCancelRoundConfirm"
      :title="t('tournament.cancelRound.title')"
      :description="t('tournament.cancelRound.description')"
      :question="t('tournament.cancelRound.question')"
      :warning="t('tournament.cancelRound.warning')"
      :confirm-label="t('tournament.cancelRound.confirmLabel')"
      :confirm-icon="ICONS.delete"
      :loading="loading"
      @confirm="lifecycle.confirmCancelRound"
    />

    <ConfirmModal
      v-model:open="showEndTournamentConfirm"
      :title="t('tournament.endEvent.title')"
      :description="t('tournament.endEvent.description')"
      :question="t('tournament.endEvent.question')"
      :warning="t('tournament.endEvent.warning')"
      :confirm-label="t('tournament.endEvent.confirmLabel')"
      :confirm-icon="ICONS.flag"
      :loading="loading"
      @confirm="lifecycle.confirmEndEvent"
    />

    <TournamentScoreModal
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

    <TournamentCommanderModal
      :show-commander-modal="showCommanderModal"
      :selected-player-id="selectedPlayerId"
      :selected-commander-pairing-id="selectedCommanderPairingId"
      :get-player-name="getPlayerName"
      :get-player="getPlayer"
      :commanders-store="commandersStore"
      :table-player-ids="commanderModalTablePlayerIds"
      @submit="(commander1, commander2) => {
        if (submitHandlers.handleCommanderSubmit(commander1, commander2))
          handleCommanderModalClosed()
      }"
      @cancel="handleCommanderModalClosed()"
    />

    <TournamentScoresModal
      :show-scores-modal="showScoresModal"
      :selected-scores-pairing-id="selectedScoresPairingId"
      :pairings="pairings"
      :tournament-players="tournamentPlayers"
      :ruleset="currentRuleset"
      @cancel="showScoresModal = false"
    />

    <TournamentKillModal
      :show-kill-modal="showKillModal"
      :selected-kill-players="selectedKillPlayers"
      :selected-kill-pairing-id="selectedKillPairingId"
      @submit="(kills) => submitHandlers.handleKillsSubmit(selectedKillPairingId!, kills)"
      @close="showKillModal = false"
    />

    <TournamentVotesModal
      :show-votes-modal="showVotesModal"
      :selected-votes-player-id="selectedVotesPlayerId"
      :get-player-name="getPlayerName"
      :get-player="getPlayer"
      :votes-store="votesStore"
      :table-players-for-votes="tablePlayersForVotes"
      :ruleset="currentRuleset"
      @submit="(deckVotePlayerId, playVotePlayerId) => {
        if (submitHandlers.handleVotesSubmit(deckVotePlayerId, playVotePlayerId))
          showVotesModal = false
      }"
      @cancel="showVotesModal = false"
      @assign-commander="handleAssignCommanderFromVotes"
    />

    <TournamentFormModal
      v-model:open="showTournamentEditModal"
      :tournament="currentTournament ?? null"
      :league-id="leagueId"
      @update="lifecycle.handleUpdateEvent"
    />
  </div>
</template>
