<!-- app\components\event\pairing\table\preview\TablePreviewModal.vue -->
<script setup lang="ts">
// Table preview modal with drag-and-drop editing, pairing constraints,
// optimizer controls, and transparent score breakdown.
import type {
  Seat,
  PairingWeights,
  TournamentPlayer,
  TournamentTable,
} from '#shared/utils/types'
import type {
  PairingHistoryEntry,
  PairingPlayer,
} from '~/composables/event-pairing/pairingOptimizer'

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const {
  tables,
  eventId,
  playersForScoring,
  history,
  currentRound,
  allPlayers,
  loading = false,
  dismissible = true,
} = defineProps<{
  tables: TournamentTable[]
  eventId: number
  playersForScoring: PairingPlayer[]
  history: PairingHistoryEntry[]
  currentRound: number
  allPlayers: TournamentPlayer[]
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
const dragSnapshot = ref<TournamentTable[] | null>(null)
const hasAutoOptimized = ref(false)

const initialPreferences = computed(() => getPairingPreferences(eventId))
const toast = useToast()

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
  cloneCurrentTables,
  restoreTables,
  runOptimizer,
  scoreDetails,
  weights,
  forbiddenPairs,
  addForbiddenPair,
  removeForbiddenPair,
  setWeights,
  setForbiddenPairs,
  conflictingTables,
} = useTableDnd(tables, {
  playersForScoring: playersForScoring,
  history: history,
  currentRound: currentRound,
  initialWeights: initialPreferences.value.weights,
  initialForbiddenPairs: initialPreferences.value.forbiddenPairs,
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
    const prefs = getPairingPreferences(eventId)
    setWeights(prefs.weights)
    setForbiddenPairs(prefs.forbiddenPairs)
  }
})

watch(
  () => [open.value, loading, playersForScoring.length] as const,
  ([isOpen, isLoading, playersCount]) => {
    if (!isOpen || isLoading || hasAutoOptimized.value) return
    if (!playersCount && !localTables.value.length) return
    runOptimizer(140)
    hasAutoOptimized.value = true
  }
)

watch([weights, forbiddenPairs], () => {
  savePairingPreferences(eventId, {
    weights: weights.value,
    forbiddenPairs: forbiddenPairs.value,
  })
}, { deep: true })



const scoreItems = computed(() => [
  { key: 'strengthBalance', label: t('event.tablePreview.scoreItems.strengthBalance'), value: weights.value.strengthBalance, min: 0, max: 3, step: 0.1 },
  { key: 'novelty', label: t('event.tablePreview.scoreItems.novelty'), value: weights.value.novelty, min: 0, max: 3, step: 0.1 },
  { key: 'rematch', label: t('event.tablePreview.scoreItems.rematch'), value: weights.value.rematch, min: 0, max: 3, step: 0.1 },
  { key: 'rotateTable3', label: t('event.tablePreview.scoreItems.rotateTable3'), value: weights.value.rotateTable3, min: 0, max: 3, step: 0.1 },
  { key: 'tableSize4', label: t('event.tablePreview.scoreItems.tableSize4'), value: weights.value.tableSize4, min: -2, max: 2, step: 0.05 },
  { key: 'tableSize3', label: t('event.tablePreview.scoreItems.tableSize3'), value: weights.value.tableSize3, min: -2, max: 2, step: 0.05 },
] as const)

const confirmLogging = useButtonLogging('Conferma tavoli', {
  eventId: () => eventId,
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

function tableCardClass(table: TournamentTable): string {
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

function addForbiddenPairFromSelectors() {
  const a = Number(pairPlayerA.value)
  const b = Number(pairPlayerB.value)
  if (!a || !b || a === b) return

  addForbiddenPair(a, b)
  pairPlayerA.value = ''
  pairPlayerB.value = ''
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

function handleDragStart() {
  dragSnapshot.value = cloneCurrentTables()
  setDragging(true)
}

function handleDragEnd() {
  setDragging(false)

  if (!isValid.value && dragSnapshot.value) {
    restoreTables(dragSnapshot.value)
    toast.add({
      title: t('event.tablePreview.invalidMoveTitle'),
      description: previewError.value || t('event.tablePreview.invalidMoveFallback'),
      color: 'error',
    })
  }

  dragSnapshot.value = null
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
    .filter((player): player is TournamentPlayer => player !== null)
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
  return localTables.value.length <= 1 ? 'max-w-2xl' : 'max-w-4xl'
})

function updateTableSeats(tableIndex: number, seats: [Seat, Seat, Seat, Seat]) {
  const targetTable = localTables.value[tableIndex]
  if (!targetTable) return
  targetTable.seats = seats
}

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
    :title="t('event.tablePreview.title')"
    :description="t('event.tablePreview.description')"
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
      />
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
    :event-id="eventId"
    @select-preset="applyWeightPreset"
    @update-weight="updateWeight"
    @add-pair="addForbiddenPairFromSelectors"
    @resolve-conflicts="autoResolveConflicts"
    @remove-pair="(playerA, playerB) => removeForbiddenPair(playerA, playerB)"
  />

  <TableScoreBreakdownModal
    v-model:open="showTableScoreBreakdown"
    :selected-table-score="selectedTableScore"
    :selected-table-player-rows="selectedTablePlayerRows"
  />
</template>
