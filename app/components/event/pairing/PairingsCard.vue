<!-- app\components\event\pairing\PairingsCard.vue -->
<script setup lang="ts">
import type { Pairing, PairingWithResults, TournamentPlayer } from '#shared/utils/types'

const { t } = useI18n()

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps<{
  /** List of pairings for the current round (with nested round_results). */
  pairings: PairingWithResults[]
  /** When true, hides all action buttons and renders the card in read-only mode. */
  readonly?: boolean
  /** Full list of tournament players used to resolve player details. */
  allPlayers: TournamentPlayer[]
}>()

// Session stores injected directly (Pinia singletons) — same pattern as the
// kill/ siblings, instead of the former optional store props.
const rankingsStore = useRankingsStore()
const commandersStore = useCommandersStore()
const killsStore = useKillsStore()
const votesStore = useVotesStore()

// ─── Emits ────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  /** Opens the score entry modal for a specific pairing and table. */
  openScoreModal: [pairingId: number, tableIndex: number]
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
  /** Declares a draw for a pairing: zero kills, every seated player ties for first. */
  draw: [pairingId: number, playerIds: number[]]
}>()

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Tracks which pairing is pending a confirmation action (reset, test fill, or
 * draw), along with the type of action. Null when no dialog is open.
 * 'fill-all' has no single pairingId — it applies to every table in the round.
 */
const confirmDialog = ref<{ type: 'reset' | 'fill' | 'draw'; pairingId: number } | { type: 'fill-all' } | null>(null)

/** Used by useButtonLogging to track the last pairing the score modal was opened for. */
const currentPairingId = ref<number | null>(null)
const currentTableIndex = ref<number | null>(null)

// ─── Logging ──────────────────────────────────────────────────────────────────

const openScoreModalLogging = useButtonLogging('Open Score Modal', {
  pairingId: () => currentPairingId.value,
  tableIndex: () => currentTableIndex.value
})

// ─── Fullscreen ───────────────────────────────────────────────────────────────
// Same pattern as RoundTimer.vue: browser Fullscreen API on a wrapping ref, so
// the tables take over the whole screen instead of sharing space with the
// standings sidebar.
const pairingsRef = useTemplateRef<HTMLDivElement>('pairingsRef')
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(pairingsRef)

const toggleFullscreenLogging = useButtonLogging('Toggle Pairings Fullscreen', {
  isFullscreen: () => isFullscreen.value,
})

function handleToggleFullscreen() {
  toggleFullscreenLogging.logClick()
  toggleFullscreen()
}

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
 * Two-way computed for the fill-all-tables confirmation modal's open state.
 * Setting it to false clears the active confirmDialog.
 */
const showFillAllConfirm = computed({
  get: () => confirmDialog.value?.type === 'fill-all',
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

/**
 * Two-way computed for the draw confirmation modal's open state.
 * Setting it to false clears the active confirmDialog.
 */
const showDrawConfirm = computed({
  get: () => confirmDialog.value?.type === 'draw',
  set: (v: boolean) => { if (!v) confirmDialog.value = null }
})

/**
 * The pairing ID currently pending a draw confirmation, derived from confirmDialog.
 * Used to resolve the table label in the draw ConfirmModal.
 */
const tableToDraw = computed(() =>
  confirmDialog.value?.type === 'draw' ? confirmDialog.value.pairingId : null
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the pairing has at least one ranking entry saved.
 */
const hasRanking = (pairingId: number): boolean => {
  const ranking = rankingsStore.getRankingWithRanks(pairingId)
  return !!ranking && ranking.length > 0
}

/**
 * True once the kill modal has been confirmed at least once for this pairing
 * (even with zero kills) — read from `round_results.number_of_kills`, which
 * `kills.post.ts` only ever writes on a confirm, staying `null` until then.
 * Not from `killsStore` (the session store): it's a single flat array shared
 * across whichever pairing's modal is currently open, not scoped per pairing,
 * so it can't answer "has this *other* table's kills been reviewed".
 */
const hasKills = (pairing: PairingWithResults): boolean =>
  (pairing.round_results ?? []).some(r => r.number_of_kills !== null)

const isDraw = (pairing: PairingWithResults): boolean =>
  isPairingDraw(pairing, rankingsStore.getRankingWithRanks(pairing.pairing_id))

/**
 * Returns true if all required data has been entered for a pairing:
 * - Rankings are saved
 * - All players have a commander set
 * - All players have submitted a vote
 */
const isTableComplete = (pairing: Pairing): boolean => {
  const playerIds = pairingPlayerIds(pairing)
  return (
    hasRanking(pairing.pairing_id) &&
    playerIds.every(id => commandersStore.getCommander1(id) !== null) &&
    playerIds.every(id => votesStore.hasVotes(id))
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

/** Queues a test-fill confirmation for every table in the round at once. */
function handleQuickTestFillAll() {
  confirmDialog.value = { type: 'fill-all' }
}

/** Queues a draw ("Patta") confirmation for the given pairing. */
function handleDrawTable(pairingId: number) {
  confirmDialog.value = { type: 'draw', pairingId }
}

/**
 * Executes the confirmed action (reset, test fill, fill-all, or draw) and
 * clears the dialog state. Called by all four ConfirmModal @confirm events.
 */
function handleConfirm() {
  if (!confirmDialog.value) return

  if (confirmDialog.value.type === 'reset') {
    emit('resetTable', confirmDialog.value.pairingId)
  } else if (confirmDialog.value.type === 'fill') {
    fillTable(confirmDialog.value.pairingId)
  } else if (confirmDialog.value.type === 'draw') {
    const pairingId = confirmDialog.value.pairingId
    const pairing = props.pairings.find(p => p.pairing_id === pairingId)
    if (pairing) emit('draw', pairingId, pairingPlayerIds(pairing))
  } else {
    for (const pairing of props.pairings) {
      fillTable(pairing.pairing_id)
    }
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

  rankingsStore.setRankingWithRanks(
    pairingId,
    playerIds.map((id, i) => ({ playerId: id, rank: i + 1 }))
  )

  killsStore.addKill(playerIds[0]!, playerIds[1]!)

  for (const id of playerIds) {
    commandersStore.setCommanders(id, 'Test Commander', null)
  }

  for (let i = 0; i < playerIds.length; i++) {
    const nextIdx = (i + 1) % playerIds.length
    votesStore.setVotes(playerIds[i]!, playerIds[nextIdx]!, playerIds[nextIdx]!)
  }
}
</script>

<template>
  <div ref="pairingsRef">
    <PairingsFullscreenView
      v-if="isFullscreen"
      :pairings="pairings"
      :all-players="allPlayers"
      @exit="handleToggleFullscreen"
    />

    <UCard v-else variant="outline">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon :name="ICONS.gridView" class="size-5 text-primary" />
          <h2 class="text-lg font-semibold">{{ t('event.pairing.tablesHeading') }}</h2>
          <QuickFillButton
            v-if="!readonly"
            :tooltip="t('event.pairing.fillAllTooltip')"
            @click="handleQuickTestFillAll"
          />
          <UTooltip :content="{ side: 'top' }" :text="t('event.pairing.fullscreenTooltip')">
            <UButton
              :icon="ICONS.expand"
              color="neutral"
              variant="ghost"
              :aria-label="t('event.pairing.fullscreenTooltip')"
              @click="handleToggleFullscreen"
            />
          </UTooltip>
        </div>
      </template>

      <div
        v-if="pairings.length > 0"
        class="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <UCard
          v-for="(pairing, index) in pairings"
          :key="pairing.pairing_id"
          :ui="{ header: 'p-2 sm:px-3', body: 'p-2 sm:p-3', footer: 'p-2 sm:px-3' }"
        >
          <!-- Table actions (view scores, reset, quick fill) — hidden in readonly mode -->
          <template v-if="!readonly" #header>
            <TableCardActions
              :pairing="pairing"
              :table-index="index"
              :is-complete="isTableComplete(pairing)"
              @view-scores="emit('openScoresModal', $event)"
              @reset-table="handleResetTable"
              @quick-fill="handleQuickTestFill"
            />
          </template>

          <!-- Player rows -->
          <div class="space-y-1.5">
            <PairingPlayerRow
              v-for="playerId in pairingPlayerIds(pairing)"
              :key="playerId"
              :player-id="playerId"
              :pairing-id="pairing.pairing_id"
              :name="allPlayers.find(p => p.id === playerId)?.name ?? ''"
              :surname="allPlayers.find(p => p.id === playerId)?.surname ?? ''"
              :readonly="readonly"
              :has-commander="!!commandersStore.getCommander1(playerId)"
              :has-votes="votesStore.hasVotes(playerId)"
              @open-commander-modal="(pairingId, pid) => emit('openCommanderModal', pairingId, pid)"
              @open-votes-modal="(pairingId, pid) => emit('openVotesModal', pairingId, pid)"
            />
          </div>

          <!-- Table-level action buttons — hidden in readonly mode -->
          <template v-if="!readonly" #footer>
            <PairingTableActions
              :pairing-id="pairing.pairing_id"
              :table-index="index"
              :has-ranking="hasRanking(pairing.pairing_id)"
              :has-kills="hasKills(pairing)"
              :is-draw="isDraw(pairing)"
              @open-score-modal="handleOpenScoreModal"
              @open-kill-modal="emit('openKillModal', $event)"
              @draw="handleDrawTable"
            />
          </template>
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

      <!-- Fill-all-tables confirmation dialog -->
      <ConfirmModal
        v-model:open="showFillAllConfirm"
        :title="t('event.pairing.fillAllConfirm.title')"
        :description="t('event.pairing.fillAllConfirm.description')"
        :question="t('event.pairing.fillAllConfirm.question')"
        :warning="t('event.pairing.fillAllConfirm.warning')"
        :confirm-label="t('event.pairing.fillAllConfirm.confirmLabel')"
        :confirm-icon="ICONS.quickAction"
        @confirm="handleConfirm"
      />

      <!-- Draw ("Patta") confirmation dialog -->
      <ConfirmModal
        v-model:open="showDrawConfirm"
        :title="t('event.pairing.drawConfirm.title')"
        :description="t('event.pairing.drawConfirm.description')"
        :question="t('event.pairing.drawConfirm.question')"
        :subject="t('event.pairing.tableHeading', { n: pairings.findIndex(p => p.pairing_id === tableToDraw) + 1 })"
        :warning="t('event.pairing.drawConfirm.warning')"
        :confirm-label="t('event.pairing.drawConfirm.confirmLabel')"
        :confirm-icon="ICONS.draw"
        @confirm="handleConfirm"
      />
    </UCard>
  </div>
</template>
