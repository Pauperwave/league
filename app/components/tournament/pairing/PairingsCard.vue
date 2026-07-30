<!-- app\components\tournament\pairing\PairingsCard.vue -->
<script setup lang="ts">
import type { Pairing, PairingWithResults, TablePlayer } from '#shared/utils/types'
import { getPairingPlayerIds } from '#shared/utils/types'

const { t } = useI18n()

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps<{
  /** List of pairings for the current round (with nested round_results). */
  pairings: PairingWithResults[]
  /** When true, hides all action buttons and renders the card in read-only mode. */
  readonly?: boolean
  /** Full list of tournament players used to resolve player details. */
  allPlayers: TablePlayer[]
}>()

// Session stores injected directly (Pinia singletons) — same pattern as the
// kill/ siblings, instead of the former optional store props.
const rankingsStore = useRankingsStore()
const commandersStore = useCommandersStore()
const killsStore = useKillsStore()
const votesStore = useVotesStore()

// Prefetch: warms useCommanderUsageQuery's cache for every seated player in
// the round as soon as the pairings render, so opening any table's commander
// modal (page passes this same player-id list — see [tournamentId].vue's
// commanderModalTablePlayerIds) hits an already-resolved cache instead of
// firing its own request. Return value intentionally unused here.
const roundPlayerIds = computed(() => props.pairings.flatMap(getPairingPlayerIds))
useCommanderUsageQuery(roundPlayerIds)

// "Compila" (quick test-fill) picks a real commander instead of a fake name,
// so the filled table renders actual card art/mana cost like a real entry
// would — same "most popular first" order CommanderSearch.vue shows for an
// empty query (sorted by edhrecRank), so it's literally the first option a
// player would see if they opened the search themselves.
const { data: commanderCatalog } = useCommanderCatalogQuery()
const firstCommanderName = computed(() => {
  const sorted = [...(commanderCatalog.value ?? [])].sort((a, b) => (a.edhrecRank ?? 999999) - (b.edhrecRank ?? 999999))
  return sorted[0]?.name ?? 'Test Commander'
})

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
  /** Undoes a previously declared draw — clears the pairing's ranking and kills. */
  undraw: [pairingId: number]
}>()

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Tracks which pairing is pending a confirmation action (reset, test fill, or
 * draw), along with the type of action. Null when no dialog is open.
 * 'fill-all' has no single pairingId — it applies to every table in the round.
 */
const confirmDialog = ref<{ type: 'reset' | 'fill' | 'draw' | 'undraw'; pairingId: number } | { type: 'fill-all' } | null>(null)

/** Used by useButtonLogging to track the last pairing the score modal was opened for. */
const currentPairingId = ref<number | null>(null)
const currentTableIndex = ref<number | null>(null)

// ─── Logging ──────────────────────────────────────────────────────────────────

const openScoreModalLogging = useButtonLogging('Open Score Modal', {
  pairingId: () => currentPairingId.value,
  tableIndex: () => currentTableIndex.value
})

/** Tracks the last pairing/player passed to the open-{scores,kill,commander,votes}-modal handlers, for logging context. */
const lastScoresModalPairingId = ref<number | null>(null)
const lastKillModalPairingId = ref<number | null>(null)
const lastCommanderModalPairingId = ref<number | null>(null)
const lastCommanderModalPlayerId = ref<number | null>(null)
const lastVotesModalPairingId = ref<number | null>(null)
const lastVotesModalPlayerId = ref<number | null>(null)

const openScoresModalLogging = useButtonLogging('Open Scores Summary Modal', {
  pairingId: () => lastScoresModalPairingId.value,
})

const openKillModalLogging = useButtonLogging('Open Kill Modal', {
  pairingId: () => lastKillModalPairingId.value,
})

const openCommanderModalLogging = useButtonLogging('Open Commander Modal', {
  pairingId: () => lastCommanderModalPairingId.value,
  playerId: () => lastCommanderModalPlayerId.value,
})

const openVotesModalLogging = useButtonLogging('Open Votes Modal', {
  pairingId: () => lastVotesModalPairingId.value,
  playerId: () => lastVotesModalPlayerId.value,
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

/**
 * Two-way computed for the "undo draw" confirmation modal's open state.
 * Setting it to false clears the active confirmDialog.
 */
const showUndrawConfirm = computed({
  get: () => confirmDialog.value?.type === 'undraw',
  set: (v: boolean) => { if (!v) confirmDialog.value = null }
})

/**
 * The pairing ID currently pending an "undo draw" confirmation, derived from confirmDialog.
 * Used to resolve the table label in the undraw ConfirmModal.
 */
const tableToUndraw = computed(() =>
  confirmDialog.value?.type === 'undraw' ? confirmDialog.value.pairingId : null
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

const { hasRanking, hasKills, isDraw, isTableComplete } = useTableCompletion(rankingsStore, commandersStore, votesStore)

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

/** Opens the scores summary modal, updating logging context before emitting. */
function handleOpenScoresModal(pairingId: number) {
  lastScoresModalPairingId.value = pairingId
  openScoresModalLogging.logClick()
  emit('openScoresModal', pairingId)
}

/** Opens the kill entry modal, updating logging context before emitting. */
function handleOpenKillModal(pairingId: number) {
  lastKillModalPairingId.value = pairingId
  openKillModalLogging.logClick()
  emit('openKillModal', pairingId)
}

/** Opens the commander selection modal, updating logging context before emitting. */
function handleOpenCommanderModal(pairingId: number, playerId: number) {
  lastCommanderModalPairingId.value = pairingId
  lastCommanderModalPlayerId.value = playerId
  openCommanderModalLogging.logClick()
  emit('openCommanderModal', pairingId, playerId)
}

/** Opens the vote entry modal, updating logging context before emitting. */
function handleOpenVotesModal(pairingId: number, playerId: number) {
  lastVotesModalPairingId.value = pairingId
  lastVotesModalPlayerId.value = playerId
  openVotesModalLogging.logClick()
  emit('openVotesModal', pairingId, playerId)
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

/** Queues a draw ("Patta") confirmation for the given pairing, or an "undo
 *  draw" one if the table is already marked as a draw — the button toggles. */
function handleDrawTable(pairingId: number) {
  const pairing = props.pairings.find(p => p.pairing_id === pairingId)
  const alreadyDrawn = !!pairing && isDraw(pairing)
  confirmDialog.value = { type: alreadyDrawn ? 'undraw' : 'draw', pairingId }
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
    if (pairing) emit('draw', pairingId, getPairingPlayerIds(pairing))
  } else if (confirmDialog.value.type === 'undraw') {
    emit('undraw', confirmDialog.value.pairingId)
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
 * - Assigns the catalog's top commander (see firstCommanderName) to each player
 * - Sets circular votes (each player votes for the next)
 */
function fillTable(pairingId: number) {
  const pairing = props.pairings.find(p => p.pairing_id === pairingId)
  if (!pairing) return

  const playerIds = getPairingPlayerIds(pairing)
  if (playerIds.length < 2) return

  rankingsStore.setRankingWithRanks(
    pairingId,
    playerIds.map((id, i) => ({ playerId: id, rank: i + 1 }))
  )

  killsStore.addKill(playerIds[0]!, playerIds[1]!)

  for (const id of playerIds) {
    commandersStore.setCommanders(id, firstCommanderName.value, null)
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
          <h2 class="text-lg font-semibold">{{ t('tournament.pairing.tablesHeading') }}</h2>
          <QuickFillButton
            v-if="!readonly"
            :tooltip="t('tournament.pairing.fillAllTooltip')"
            @click="handleQuickTestFillAll"
          />
          <UTooltip :content="{ side: 'top' }" :text="t('tournament.pairing.fullscreenTooltip')">
            <UButton
              :icon="ICONS.expand"
              color="neutral"
              variant="ghost"
              :aria-label="t('tournament.pairing.fullscreenTooltip')"
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
              @view-scores="handleOpenScoresModal"
              @reset-table="handleResetTable"
              @quick-fill="handleQuickTestFill"
            />
          </template>

          <!-- Player rows -->
          <div class="space-y-1.5">
            <PairingPlayerRow
              v-for="playerId in getPairingPlayerIds(pairing)"
              :key="playerId"
              :player-id="playerId"
              :pairing-id="pairing.pairing_id"
              :name="allPlayers.find(p => p.id === playerId)?.name ?? ''"
              :surname="allPlayers.find(p => p.id === playerId)?.surname ?? ''"
              :readonly="readonly"
              :has-commander="!!commandersStore.getCommander1(playerId)"
              :has-votes="votesStore.hasVotes(playerId)"
              @open-commander-modal="handleOpenCommanderModal"
              @open-votes-modal="handleOpenVotesModal"
            />
          </div>

          <!-- Table-level action buttons — hidden in readonly mode -->
          <template v-if="!readonly" #footer>
            <PairingTableActions
              :pairing-id="pairing.pairing_id"
              :table-index="index"
              :has-ranking="hasRanking(pairing)"
              :has-kills="hasKills(pairing)"
              :is-draw="isDraw(pairing)"
              @open-score-modal="handleOpenScoreModal"
              @open-kill-modal="handleOpenKillModal"
              @draw="handleDrawTable"
            />
          </template>
        </UCard>
      </div>

      <UEmpty v-else :icon="ICONS.players" :title="t('tournament.pairing.noTablesAvailable')" />

      <!-- Reset confirmation dialog -->
      <ConfirmModal
        v-model:open="showResetConfirm"
        :title="t('tournament.pairing.resetConfirm.title')"
        :description="t('tournament.pairing.resetConfirm.description')"
        :question="t('tournament.pairing.resetConfirm.question')"
        :subject="t('tournament.pairing.tableHeading', { n: pairings.findIndex(p => p.pairing_id === tableToReset) + 1 })"
        :confirm-label="t('tournament.pairing.resetConfirm.confirmLabel')"
        :confirm-icon="ICONS.reset"
        @confirm="handleConfirm"
      />

      <!-- Test fill confirmation dialog -->
      <ConfirmModal
        v-model:open="showFillConfirm"
        :title="t('tournament.pairing.fillConfirm.title')"
        :description="t('tournament.pairing.fillConfirm.description')"
        :question="t('tournament.pairing.fillConfirm.question')"
        :subject="t('tournament.pairing.tableHeading', { n: pairings.findIndex(p => p.pairing_id === tableToFill) + 1 })"
        :warning="t('tournament.pairing.fillConfirm.warning')"
        :confirm-label="t('tournament.pairing.fillConfirm.confirmLabel')"
        :confirm-icon="ICONS.quickAction"
        @confirm="handleConfirm"
      />

      <!-- Fill-all-tables confirmation dialog -->
      <ConfirmModal
        v-model:open="showFillAllConfirm"
        :title="t('tournament.pairing.fillAllConfirm.title')"
        :description="t('tournament.pairing.fillAllConfirm.description')"
        :question="t('tournament.pairing.fillAllConfirm.question')"
        :warning="t('tournament.pairing.fillAllConfirm.warning')"
        :confirm-label="t('tournament.pairing.fillAllConfirm.confirmLabel')"
        :confirm-icon="ICONS.quickAction"
        @confirm="handleConfirm"
      />

      <!-- Draw ("Patta") confirmation dialog -->
      <ConfirmModal
        v-model:open="showDrawConfirm"
        :title="t('tournament.pairing.drawConfirm.title')"
        :description="t('tournament.pairing.drawConfirm.description')"
        :question="t('tournament.pairing.drawConfirm.question')"
        :subject="t('tournament.pairing.tableHeading', { n: pairings.findIndex(p => p.pairing_id === tableToDraw) + 1 })"
        :warning="t('tournament.pairing.drawConfirm.warning')"
        :confirm-label="t('tournament.pairing.drawConfirm.confirmLabel')"
        :confirm-icon="ICONS.draw"
        @confirm="handleConfirm"
      />

      <!-- "Annulla Patta" confirmation dialog -->
      <ConfirmModal
        v-model:open="showUndrawConfirm"
        :title="t('tournament.pairing.undrawConfirm.title')"
        :description="t('tournament.pairing.undrawConfirm.description')"
        :question="t('tournament.pairing.undrawConfirm.question')"
        :subject="t('tournament.pairing.tableHeading', { n: pairings.findIndex(p => p.pairing_id === tableToUndraw) + 1 })"
        :confirm-label="t('tournament.pairing.undrawConfirm.confirmLabel')"
        :confirm-icon="ICONS.undo"
        @confirm="handleConfirm"
      />
    </UCard>
  </div>
</template>
