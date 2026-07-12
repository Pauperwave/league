<!-- app/components/events/Pairings/PairingsCard.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import type { Pairing, TournamentPlayer, Kill } from '#shared/utils/types'

const { t } = useI18n()

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps<{
  /** List of pairings for the current round. */
  pairings: Pairing[]
  /** When true, hides all action buttons and renders the card in read-only mode. */
  readonly?: boolean
  /** Full list of tournament players used to resolve player details. */
  allPlayers: TournamentPlayer[]
  /** Store managing player rankings per pairing. */
  rankings?: ReturnType<typeof useRankingsStore>
  /** Store managing commander selections per player. */
  commandersStore?: ReturnType<typeof useCommandersStore>
  /** Store managing kill records and pairing confirmation state. */
  killsStore?: ReturnType<typeof useKillsStore>
  /** Store managing player votes per pairing. */
  votesStore?: ReturnType<typeof useVotesStore>
}>()

// ─── Emits ────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  /** Opens the score entry modal for a specific pairing and table. */
  openScoreModal: [pairingId: number, tableIndex: number]
  /** Persists kill records to the database for a given pairing. */
  submitKills: [pairingId: number, kills: Kill[]]
  /** Opens the commander selection modal for a specific player in a pairing. */
  openCommanderModal: [pairingId: number, playerId: number]
  /** Opens the scores summary modal for a given pairing. */
  openScoresModal: [pairingId: number]
  /** Opens the vote entry modal for a specific player in a pairing. */
  openVotesModal: [pairingId: number, playerId: number]
  /** Opens the kill entry modal for a given pairing. */
  openKillModal: [pairingId: number]
  /** Resets all data for a given pairing table. */
  resetTable: [pairingId: number]
}>()

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Tracks which pairing is pending a confirmation action (reset or test fill),
 * along with the type of action. Null when no dialog is open.
 */
const confirmDialog = ref<{ type: 'reset' | 'fill'; pairingId: number } | null>(null)

/** Used by useButtonLogging to track the last pairing the score modal was opened for. */
const currentPairingId = ref<number | null>(null)
const currentTableIndex = ref<number | null>(null)

// ─── Logging ──────────────────────────────────────────────────────────────────

const openScoreModalLogging = useButtonLogging('Open Score Modal', {
  pairingId: () => currentPairingId.value,
  tableIndex: () => currentTableIndex.value
})

// ─── Computed ─────────────────────────────────────────────────────────────────

/**
 * Two-way computed for the reset confirmation modal's open state.
 * Setting it to false clears the active confirmDialog.
 */
const showResetConfirm = computed({
  get: () => confirmDialog.value?.type === 'reset',
  set: (v: boolean) => { if (!v) confirmDialog.value = null }
})

/**
 * Two-way computed for the test-fill confirmation modal's open state.
 * Setting it to false clears the active confirmDialog.
 */
const showFillConfirm = computed({
  get: () => confirmDialog.value?.type === 'fill',
  set: (v: boolean) => { if (!v) confirmDialog.value = null }
})

/**
 * The pairing ID currently pending a reset confirmation, derived from confirmDialog.
 * Used to resolve the table label in the reset ConfirmModal.
 */
const tableToReset = computed(() =>
  confirmDialog.value?.type === 'reset' ? confirmDialog.value.pairingId : null
)

/**
 * The pairing ID currently pending a test-fill confirmation, derived from confirmDialog.
 * Used to resolve the table label in the fill ConfirmModal.
 */
const tableToFill = computed(() =>
  confirmDialog.value?.type === 'fill' ? confirmDialog.value.pairingId : null
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the list of non-null player IDs for a given pairing (2 to 4 players).
 */
const pairingPlayerIds = (pairing: Pairing): number[] =>
  [
    pairing.pairing_player1_id,
    pairing.pairing_player2_id,
    pairing.pairing_player3_id,
    pairing.pairing_player4_id
  ].filter((id): id is number => !!id)

/**
 * Returns true if the pairing has at least one ranking entry saved.
 */
const hasRanking = (pairingId: number): boolean => {
  const ranking = props.rankings?.getRankingWithRanks(pairingId)
  return !!ranking && ranking.length > 0
}

/**
 * Returns true if all required data has been entered for a pairing:
 * - Rankings are saved
 * - Kills have been confirmed (even if zero)
 * - All players have a commander set
 * - All players have submitted a vote
 */
const isTableComplete = (pairing: Pairing): boolean => {
  const playerIds = pairingPlayerIds(pairing)
  return (
    hasRanking(pairing.pairing_id) &&
    !!props.killsStore?.isPairingConfirmed(pairing.pairing_id) &&
    playerIds.every(id => props.commandersStore?.getCommander1(id) !== null) &&
    playerIds.every(id => props.votesStore?.hasVotes(id) === true)
  )
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Opens the score entry modal, updating logging context before emitting.
 */
function handleOpenScoreModal(pairingId: number, tableIndex: number) {
  currentPairingId.value = pairingId
  currentTableIndex.value = tableIndex
  openScoreModalLogging.logClick()
  emit('openScoreModal', pairingId, tableIndex)
}

/** Queues a reset confirmation for the given pairing. */
function handleResetTable(pairingId: number) {
  confirmDialog.value = { type: 'reset', pairingId }
}

/** Queues a test-fill confirmation for the given pairing. */
function handleQuickTestFill(pairing: Pairing) {
  confirmDialog.value = { type: 'fill', pairingId: pairing.pairing_id }
}

/**
 * Executes the confirmed action (reset or test fill) and clears the dialog state.
 * Called by both ConfirmModal @confirm events.
 */
function handleConfirm() {
  if (!confirmDialog.value) return
  const { type, pairingId } = confirmDialog.value

  if (type === 'reset') {
    emit('resetTable', pairingId)
  } else {
    fillTable(pairingId)
  }

  confirmDialog.value = null
}

/**
 * Fills a pairing table with dummy test data:
 * - Sets sequential rankings for all players
 * - Adds a kill from player 1 → player 2 and confirms the pairing
 * - Assigns a placeholder commander to each player
 * - Sets circular votes (each player votes for the next)
 */
function fillTable(pairingId: number) {
  const pairing = props.pairings.find(p => p.pairing_id === pairingId)
  if (!pairing) return

  const playerIds = pairingPlayerIds(pairing)
  if (playerIds.length < 2) return

  props.rankings?.setRankingWithRanks(
    pairingId,
    playerIds.map((id, i) => ({ playerId: id, rank: i + 1 }))
  )

  props.killsStore?.addKill(playerIds[0]!, playerIds[1]!)
  props.killsStore?.confirmPairing(pairingId)

  for (const id of playerIds) {
    props.commandersStore?.setCommanders(id, 'Test Commander', null)
  }

  for (let i = 0; i < playerIds.length; i++) {
    const nextIdx = (i + 1) % playerIds.length
    props.votesStore?.setVotes(playerIds[i]!, playerIds[nextIdx]!, playerIds[nextIdx]!)
  }
}

/**
 * Toggles the kill confirmation state for a pairing.
 * - If already confirmed: removes confirmation.
 * - If not confirmed: confirms and persists kills to the DB via the parent's submitKills handler.
 */
function toggleKillConfirmation(pairingId: number) {
  if (props.killsStore?.isPairingConfirmed(pairingId)) {
    props.killsStore?.unconfirmPairing(pairingId)
    return
  }

  props.killsStore?.confirmPairing(pairingId)

  const pairing = props.pairings.find(p => p.pairing_id === pairingId)
  if (!pairing) return

  const playerIds = pairingPlayerIds(pairing)
  const pairingKills = props.killsStore?.kills.filter(k => playerIds.includes(k.killerId)) ?? []
  emit('submitKills', pairingId, pairingKills)
}
</script>

<template>
  <UCard variant="outline">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon :name="ICONS.gridView" class="size-5 text-primary" />
        <h2 class="text-lg font-semibold">{{ t('event.pairing.tablesHeading') }}</h2>
      </div>
    </template>

    <div v-if="pairings.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <UCard
        v-for="(pairing, index) in pairings"
        :key="pairing.pairing_id"
      >
        <!-- Table actions (view scores, reset, quick fill) — hidden in readonly mode -->
        <div v-if="!readonly" class="flex items-center justify-between mb-3">
          <TableCardActions
            :pairing="pairing"
            :table-index="index"
            :is-complete="isTableComplete(pairing)"
            @view-scores="emit('openScoresModal', $event)"
            @reset-table="handleResetTable"
            @quick-fill="handleQuickTestFill"
          />
        </div>

        <!-- Player rows -->
        <div class="space-y-2">
          <PairingPlayerRow
            v-for="playerId in pairingPlayerIds(pairing)"
            :key="playerId"
            :player-id="playerId"
            :pairing-id="pairing.pairing_id"
            :name="allPlayers.find(p => p.id === playerId)?.name ?? ''"
            :surname="allPlayers.find(p => p.id === playerId)?.surname ?? ''"
            :readonly="readonly"
            :has-commander="!!commandersStore?.getCommander1(playerId)"
            :has-votes="votesStore?.hasVotes(playerId) === true"
            @open-commander-modal="(pairingId, pid) => emit('openCommanderModal', pairingId, pid)"
            @open-votes-modal="(pairingId, pid) => emit('openVotesModal', pairingId, pid)"
          />
        </div>

        <!-- Table-level action buttons — hidden in readonly mode -->
        <PairingTableActions
          v-if="!readonly"
          :pairing-id="pairing.pairing_id"
          :table-index="index"
          :has-ranking="hasRanking(pairing.pairing_id)"
          :kills-confirmed="!!killsStore?.isPairingConfirmed(pairing.pairing_id)"
          @open-score-modal="handleOpenScoreModal"
          @open-kill-modal="emit('openKillModal', $event)"
          @toggle-kill-confirmation="toggleKillConfirmation"
        />
      </UCard>
    </div>

    <UEmpty v-else :icon="ICONS.players" :title="t('event.pairing.noTablesAvailable')" />

    <!-- Reset confirmation dialog -->
    <ConfirmModal
      v-model:open="showResetConfirm"
      :title="t('event.pairing.resetConfirm.title')"
      :description="t('event.pairing.resetConfirm.description')"
      :question="t('event.pairing.resetConfirm.question')"
      :subject="t('event.pairing.tableHeading', { n: pairings.findIndex(p => p.pairing_id === tableToReset) + 1 })"
      :confirm-label="t('event.pairing.resetConfirm.confirmLabel')"
      :confirm-icon="ICONS.reset"
      @confirm="handleConfirm"
    />

    <!-- Test fill confirmation dialog -->
    <ConfirmModal
      v-model:open="showFillConfirm"
      :title="t('event.pairing.fillConfirm.title')"
      :description="t('event.pairing.fillConfirm.description')"
      :question="t('event.pairing.fillConfirm.question')"
      :subject="t('event.pairing.tableHeading', { n: pairings.findIndex(p => p.pairing_id === tableToFill) + 1 })"
      :warning="t('event.pairing.fillConfirm.warning')"
      :confirm-label="t('event.pairing.fillConfirm.confirmLabel')"
      :confirm-icon="ICONS.quickAction"
      @confirm="handleConfirm"
    />
  </UCard>
</template>
