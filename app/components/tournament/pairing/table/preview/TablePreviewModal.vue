<!-- app\components\tournament\pairing\table\preview\TablePreviewModal.vue -->
<script setup lang="ts">
// Table preview modal with drag-and-drop editing, pairing constraints,
// optimizer controls, and transparent score breakdown.
import type {
  PairingWeights,
  TablePlayer,
  PairingTable,
} from '#shared/utils/types'
import type {
  PairingHistoryEntry,
  PairingPlayer,
} from '~/composables/event-pairing/pairingOptimizer'

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const {
  tables,
  tournamentId,
  playersForScoring,
  history,
  currentRound,
  allPlayers,
  loading = false,
  dismissible = true,
} = defineProps<{
  tables: PairingTable[]
  tournamentId: number
  playersForScoring: PairingPlayer[]
  history: PairingHistoryEntry[]
  currentRound: number
  allPlayers: TablePlayer[]
  loading?: boolean
  dismissible?: boolean
}>()

const emit = defineEmits<{
  confirm: [playerOrder: number[]]
  cancel: []
}>()

const showSettings = ref(false)
const showTableScoreBreakdown = ref(false)
const selectedTableIndex = ref<number | null>(null)
const pairPlayerA = ref<string>('')
const pairPlayerB = ref<string>('')
const hasAutoOptimized = ref(false)

const toast = useToast()

const { data: avoidPairsData } = useAvoidPairsQuery()
const { addAvoidPair, removeAvoidPair } = useAvoidPairsMutations()

const {
  localTables,
  isDragging,
  isValid,
  previewError,
  playerOrder,
  tableStatus,
  setDragging,
  reset,
  syncFromSource,
  normalizeLocalTables,
  updateTableSeats,
  cloneCurrentTables,
  restoreTables,
  runOptimizer,
  randomizeTables,
  scoreDetails,
  weights,
  forbiddenPairs,
  setWeights,
  setForbiddenPairs,
  conflictingTables,
} = useTableDnd(tables, {
  playersForScoring: playersForScoring,
  history: history,
  currentRound: currentRound,
  initialWeights: getPairingWeights(tournamentId),
  initialForbiddenPairs: avoidPairsData.value ?? [],
})

watch(
  () => tables,
  (tables) => {
    syncFromSource(tables)
  },
  { deep: true }
)

watch(open, (value) => {
  if (value) {
    hasAutoOptimized.value = false
    reset()
    setWeights(getPairingWeights(tournamentId))
    setForbiddenPairs(avoidPairsData.value ?? [])
  }
})

// Keeps the in-preview forbidden-pairs set aligned with the global DB list
// (avoid-pairs are no longer per-tournament state) — refetches after
// addForbiddenPairFromSelectors/removeForbiddenPair invalidate the query.
watch(avoidPairsData, (pairs) => {
  setForbiddenPairs(pairs ?? [])
})

// Round 1 has no pairing history yet, so the optimizer's table3Count-based
// rotation signal is always 0 for everyone — it degrades to a plain rank
// sort, which systematically seats lower-ranked players at the 3-player
// tables (a rank-driven bias, not a random one). Randomizing instead removes
// that bias; round 2+ keeps the optimizer, which has real rotation data to
// work with by then.
watch(
  () => [open.value, loading, playersForScoring.length] as const,
  ([isOpen, isLoading, playersCount]) => {
    if (!isOpen || isLoading || hasAutoOptimized.value) return
    if (!playersCount && !localTables.value.length) return
    if (currentRound === 1) {
      randomizeTables()
    } else {
      runOptimizer(140)
    }
    hasAutoOptimized.value = true
  }
)

watch(weights, () => {
  savePairingWeights(tournamentId, weights.value)
}, { deep: true })



const scoreItems = computed(() => [
  { key: 'strengthBalance', label: t('tournament.tablePreview.scoreItems.strengthBalance'), value: weights.value.strengthBalance, min: 0, max: 3, step: 0.1 },
  { key: 'novelty', label: t('tournament.tablePreview.scoreItems.novelty'), value: weights.value.novelty, min: 0, max: 3, step: 0.1 },
  { key: 'rematch', label: t('tournament.tablePreview.scoreItems.rematch'), value: weights.value.rematch, min: 0, max: 3, step: 0.1 },
  { key: 'rotateTable3', label: t('tournament.tablePreview.scoreItems.rotateTable3'), value: weights.value.rotateTable3, min: 0, max: 3, step: 0.1 },
  { key: 'tableSize4', label: t('tournament.tablePreview.scoreItems.tableSize4'), value: weights.value.tableSize4, min: -2, max: 2, step: 0.05 },
  { key: 'tableSize3', label: t('tournament.tablePreview.scoreItems.tableSize3'), value: weights.value.tableSize3, min: -2, max: 2, step: 0.05 },
] as const)

const confirmLogging = useButtonLogging(t('logging.pairing.confirmTables'), {
  tournamentId: () => tournamentId,
  currentRound: () => currentRound,
  tableCount: () => localTables.value.length,
  isValid: () => isValid.value,
  hasAutoOptimized: () => hasAutoOptimized.value,
})

function handleConfirm() {
  confirmLogging.logClick()
  normalizeLocalTables()
  if (!isValid.value) return
  emit('confirm', playerOrder.value)
}

function handleCancel() {
  open.value = false
  emit('cancel')
}

function tableCardClass(table: PairingTable): string {
  if (conflictingTables.value.has(table.id)) {
    return 'bg-error/10 ring-1 ring-inset ring-error/30'
  }

  const status = tableStatus(table).color
  if (status === 'warning') return 'bg-warning/10 ring-1 ring-inset ring-warning/30'
  if (status === 'error') return 'bg-error/10 ring-1 ring-inset ring-error/30'
  return 'bg-muted/20'
}

function updateWeight(key: keyof PairingWeights, value: number) {
  setWeights({ [key]: Number(value.toFixed(2)) })
}

async function addForbiddenPairFromSelectors() {
  const a = Number(pairPlayerA.value)
  const b = Number(pairPlayerB.value)
  if (!a || !b || a === b) return

  await addAvoidPair.mutateAsync({ playerA: a, playerB: b })
  pairPlayerA.value = ''
  pairPlayerB.value = ''
}

async function removeForbiddenPairFromModal(playerA: number, playerB: number) {
  await removeAvoidPair.mutateAsync({ playerA, playerB })
}

const { selectedPreset, applyWeightPreset } = usePairingPresets(weights, setWeights)

const { optimizeNow: optimizePreviewTables, autoResolveConflicts } = useOptimizationNotifier({
  toast,
  isValid,
  previewError,
  scoreDetails,
  cloneCurrentTables,
  restoreTables,
  runOptimizer,
})

function optimizeNow() {
  if (loading) return
  optimizePreviewTables()
}

function randomizeNow() {
  if (loading) return
  randomizeTables()
}

function handleDragStart() {
  setDragging(true)
}

const dragSeatLogging = useButtonLogging(t('logging.pairing.dragSeat'), {
  tournamentId: () => tournamentId,
  currentRound: () => currentRound,
  wasValid: () => isValid.value,
})

// No forced revert/swap-detection on drop anymore — a drag can freely leave
// tables in an intermediate, temporarily-invalid shape (e.g. moving one
// player out of a full table without immediately moving someone back).
// `tableStatus()`'s per-table badge already gives live feedback, and
// `isValid`/`previewError` gate the Confirm button (see #footer below) —
// validity only actually matters at confirm time.
function handleDragEnd() {
  setDragging(false)
  dragSeatLogging.logClick()
}


const selectedTableScore = computed(() => {
  if (selectedTableIndex.value === null) return null
  return scoreDetails.value.tableScores[selectedTableIndex.value] ?? null
})

const selectedTablePlayers = computed(() => {
  if (selectedTableIndex.value === null) return []

  const table = localTables.value[selectedTableIndex.value]
  if (!table) return []

  return table.seats
    .map(seat => seat.player)
    .filter((player): player is TablePlayer => player !== null)
})

const selectedTablePlayerRows = computed(() => {
  const score = selectedTableScore.value
  if (!score) return []

  const scoreByPlayer = new Map(score.players.map(item => [item.playerId, item]))
  return selectedTablePlayers.value.map((player) => ({
    player,
    detail: scoreByPlayer.get(player.id),
  }))
})

const modalMaxWidth = computed(() => {
  return localTables.value.length <= 1 ? 'max-w-3xl' : 'max-w-6xl'
})

function tableScoreForIndex(tableIndex: number): number {
  return scoreDetails.value.tableScores[tableIndex]?.total ?? 0
}

function openTableScoreBreakdown(tableIndex: number) {
  selectedTableIndex.value = tableIndex
  showTableScoreBreakdown.value = true
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('tournament.tablePreview.title')"
    :description="t('tournament.tablePreview.description')"
    :dismissible="dismissible"
    :ui="{ content: modalMaxWidth, footer: 'justify-end gap-1.5' }"
  >
    <template #body>
      <div class="space-y-3">
        <TablePreviewToolbar
          :total-score="scoreDetails.totalScore"
          :loading="loading"
          @open-settings="showSettings = true"
          @optimize="optimizeNow"
          @random="randomizeNow"
        />

        <TablePreviewGrid
          :tables="localTables"
          :is-dragging="isDragging"
          :get-table-card-class="tableCardClass"
          :get-table-status="tableStatus"
          :get-table-score="tableScoreForIndex"
          @update-seats="updateTableSeats"
          @drag-start="handleDragStart"
          @drag-end="handleDragEnd"
          @open-breakdown="openTableScoreBreakdown"
        />
      </div>
    </template>

    <template #footer>
      <ModalFooterActions
        :confirm-label="t('common.confirm')"
        :confirm-disabled="!isValid"
        @cancel="handleCancel"
        @confirm="handleConfirm"
      >
        <template v-if="!isValid" #start>
          <span class="text-sm text-error">{{ previewError }}</span>
        </template>
      </ModalFooterActions>
    </template>
  </UModal>

  <PairingSettingsModal
    v-model:open="showSettings"
    v-model:pair-player-a="pairPlayerA"
    v-model:pair-player-b="pairPlayerB"
    :selected-preset="selectedPreset"
    :score-items="scoreItems"
    :forbidden-pairs="forbiddenPairs"
    :all-players="allPlayers"
    @select-preset="applyWeightPreset"
    @update-weight="updateWeight"
    @add-pair="addForbiddenPairFromSelectors"
    @resolve-conflicts="autoResolveConflicts"
    @remove-pair="removeForbiddenPairFromModal"
  />

  <TableScoreBreakdownModal
    v-model:open="showTableScoreBreakdown"
    :selected-table-score="selectedTableScore"
    :selected-table-player-rows="selectedTablePlayerRows"
  />
</template>
