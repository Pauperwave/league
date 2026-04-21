<script setup lang="ts">
// Table preview modal with drag-and-drop editing, pairing constraints,
// optimizer controls, and transparent score breakdown.
import type {
  PairingWeights,
  TournamentPlayer,
  TournamentTable,
} from '#shared/utils/types'
import { VueDraggable } from 'vue-draggable-plus'
import {
  DEFAULT_PAIRING_WEIGHTS,
  getForbiddenPairKey,
} from '~/composables/tables/pairingOptimizer'
import type {
  PairingHistoryEntry,
  PairingPlayer,
} from '~/composables/tables/pairingOptimizer'
import { getPairingPreferences, savePairingPreferences } from '~/composables/tables/pairingPreferences'
import type { PairingPresetKind } from './PairingPresetButtons.vue'

const open = defineModel<boolean>('open', { default: false })

interface Props {
  tables: TournamentTable[]
  eventId: number
  playersForScoring: PairingPlayer[]
  history: PairingHistoryEntry[]
  currentRound: number
  allPlayers: TournamentPlayer[]
  loading?: boolean
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  dismissible: true,
})

const emit = defineEmits<{
  confirm: [playerOrder: number[]]
  cancel: []
}>()

const showSettings = ref(false)
const showTableScoreBreakdown = ref(false)
const selectedTableIndex = ref<number | null>(null)
const pairPlayerA = ref<string>('')
const pairPlayerB = ref<string>('')
const pairPlayerBSelectRef = ref<any>(null)
const addForbiddenPairButtonRef = ref<any>(null)
const dragSnapshot = ref<TournamentTable[] | null>(null)
const hasAutoOptimized = ref(false)

const initialPreferences = computed(() => getPairingPreferences(props.eventId))
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
  replaceByPlayerOrder,
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
} = useTableDnd(props.tables, {
  playersForScoring: props.playersForScoring,
  history: props.history,
  currentRound: props.currentRound,
  initialWeights: initialPreferences.value.weights,
  initialForbiddenPairs: initialPreferences.value.forbiddenPairs,
})

watch(
  () => props.tables,
  (tables) => {
    syncFromSource(tables)
  },
  { deep: true }
)

watch(open, (value) => {
  if (value) {
    hasAutoOptimized.value = false
    reset()
    const prefs = getPairingPreferences(props.eventId)
    setWeights(prefs.weights)
    setForbiddenPairs(prefs.forbiddenPairs)
  }
})

watch(
  () => [open.value, props.loading, props.playersForScoring.length] as const,
  ([isOpen, isLoading, playersCount]) => {
    if (!isOpen || isLoading || hasAutoOptimized.value) return
    if (!playersCount && !localTables.value.length) return
    runOptimizer(140)
    hasAutoOptimized.value = true
  }
)

watch([weights, forbiddenPairs], () => {
  savePairingPreferences(props.eventId, {
    weights: weights.value,
    forbiddenPairs: forbiddenPairs.value,
  })
}, { deep: true })

const playerOptions = computed(() =>
  props.allPlayers.map(player => ({
    label: player.name,
    value: String(player.id),
  }))
)

const forbiddenPairsDisplay = computed(() => {
  const playerMap = new Map(props.allPlayers.map(player => [player.id, player.name]))
  return forbiddenPairs.value.map(pair => ({
    key: getForbiddenPairKey(pair.playerA, pair.playerB),
    playerA: pair.playerA,
    playerB: pair.playerB,
    label: `${playerMap.get(pair.playerA) ?? `Player ${pair.playerA}`} — ${playerMap.get(pair.playerB) ?? `Player ${pair.playerB}`}`,
  }))
})

const scoreItems = computed(() => [
  { key: 'strengthBalance', label: 'Bilanciamento forza', value: weights.value.strengthBalance, min: 0, max: 3, step: 0.1 },
  { key: 'novelty', label: 'Nuovi incroci', value: weights.value.novelty, min: 0, max: 3, step: 0.1 },
  { key: 'rematch', label: 'Penalità rematch', value: weights.value.rematch, min: 0, max: 3, step: 0.1 },
  { key: 'rotateTable3', label: 'Rotazione tavoli da 3', value: weights.value.rotateTable3, min: 0, max: 3, step: 0.1 },
  { key: 'tableSize4', label: 'Bonus tavoli da 4', value: weights.value.tableSize4, min: -2, max: 2, step: 0.05 },
  { key: 'tableSize3', label: 'Peso tavoli da 3', value: weights.value.tableSize3, min: -2, max: 2, step: 0.05 },
])

function playerInitial(player: TournamentPlayer): string {
  return player.name.trim().charAt(0).toUpperCase() || '?'
}

function playerDisplayName(player: TournamentPlayer): { name: string; surname: string } {
  const normalizedSurname = player.surname.trim()
  const fullName = player.name.trim()
  const fullNameLower = fullName.toLowerCase()
  const surnameLower = normalizedSurname.toLowerCase()

  if (fullNameLower.endsWith(surnameLower)) {
    const splitIndex = fullName.length - normalizedSurname.length
    const firstName = fullName.slice(0, splitIndex).trim()
    return {
      name: firstName,
      surname: normalizedSurname,
    }
  }

  return {
    name: fullName,
    surname: normalizedSurname,
  }
}

function visibleSeats(table: TournamentTable) {
  const occupiedCount = table.seats.filter(seat => seat.player !== null).length
  return occupiedCount >= 4 ? table.seats.filter(seat => seat.player !== null) : table.seats
}

function handleConfirm() {
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

function resetWeights() {
  setWeights({ ...DEFAULT_PAIRING_WEIGHTS })
}

function optimizeNow() {
  if (props.loading) return

  const beforeTotal = scoreDetails.value.totalScore
  const beforeTableTotals = scoreDetails.value.tableScores.map(table => table.total)

  const changed = runOptimizer(220)

  const afterTotal = scoreDetails.value.totalScore
  const afterTableTotals = scoreDetails.value.tableScores.map(table => table.total)

  notifyOptimizationResult({
    changed,
    beforeTotal,
    afterTotal,
    beforeTableTotals,
    afterTableTotals,
    successTitle: 'Ottimizzazione completata',
    noChangeTitle: 'Accoppiamenti già ottimizzati',
  })
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
      title: 'Spostamento non valido',
      description: previewError.value || 'Questa disposizione non è consentita',
      color: 'error',
    })
  }

  dragSnapshot.value = null
}

function applyWeightPreset(kind: Exclude<PairingPresetKind, 'custom'>) {
  if (kind === 'reset') {
    resetWeights()
    return
  }

  if (kind === 'social') {
    setWeights({
      strengthBalance: 0.8,
      novelty: 1.7,
      rematch: 1.8,
      rotateTable3: 1.3,
      tableSize4: 0.1,
      tableSize3: -0.2,
    })
    return
  }

  if (kind === 'competitive') {
    setWeights({
      strengthBalance: 1.8,
      novelty: 0.9,
      rematch: 1.2,
      rotateTable3: 0.8,
      tableSize4: 0.2,
      tableSize3: -0.1,
    })
    return
  }

  setWeights({ ...DEFAULT_PAIRING_WEIGHTS })
}

function closeTo(a: number, b: number) {
  return Math.abs(a - b) < 0.001
}

const selectedPreset = computed<PairingPresetKind>(() => {
  const w = weights.value

  if (
    closeTo(w.strengthBalance, DEFAULT_PAIRING_WEIGHTS.strengthBalance)
    && closeTo(w.novelty, DEFAULT_PAIRING_WEIGHTS.novelty)
    && closeTo(w.rematch, DEFAULT_PAIRING_WEIGHTS.rematch)
    && closeTo(w.rotateTable3, DEFAULT_PAIRING_WEIGHTS.rotateTable3)
    && closeTo(w.tableSize4, DEFAULT_PAIRING_WEIGHTS.tableSize4)
    && closeTo(w.tableSize3, DEFAULT_PAIRING_WEIGHTS.tableSize3)
  ) {
    return 'balanced'
  }

  if (
    closeTo(w.strengthBalance, 0.8)
    && closeTo(w.novelty, 1.7)
    && closeTo(w.rematch, 1.8)
    && closeTo(w.rotateTable3, 1.3)
    && closeTo(w.tableSize4, 0.1)
    && closeTo(w.tableSize3, -0.2)
  ) {
    return 'social'
  }

  if (
    closeTo(w.strengthBalance, 1.8)
    && closeTo(w.novelty, 0.9)
    && closeTo(w.rematch, 1.2)
    && closeTo(w.rotateTable3, 0.8)
    && closeTo(w.tableSize4, 0.2)
    && closeTo(w.tableSize3, -0.1)
  ) {
    return 'competitive'
  }

  return 'custom'
})

function autoResolveConflicts() {
  const snapshot = cloneCurrentTables()
  const beforeTotal = scoreDetails.value.totalScore
  const beforeTableTotals = scoreDetails.value.tableScores.map(table => table.total)

  const changed = runOptimizer(220)

  if (!isValid.value) {
    restoreTables(snapshot)
    toast.add({
      title: 'Risoluzione conflitti non riuscita',
      description: previewError.value || 'Nessuna soluzione valida trovata',
      color: 'error',
    })
    return
  }

  const afterTotal = scoreDetails.value.totalScore
  const afterTableTotals = scoreDetails.value.tableScores.map(table => table.total)

  if (afterTotal < beforeTotal) {
    restoreTables(snapshot)
    toast.add({
      title: 'Accoppiamenti già ottimizzati',
      description: 'Non sono stati trovati miglioramenti con i vincoli correnti',
      color: 'neutral',
    })
    return
  }

  notifyOptimizationResult({
    changed,
    beforeTotal,
    afterTotal,
    beforeTableTotals,
    afterTableTotals,
    successTitle: 'Risoluzione conflitti completata',
    noChangeTitle: 'Accoppiamenti già ottimizzati',
  })
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

const canAddForbiddenPair = computed(() => {
  if (!pairPlayerA.value || !pairPlayerB.value) return false
  return pairPlayerA.value !== pairPlayerB.value
})

const pairingStorageKey = computed(() => `pairing-preferences-event-${props.eventId}`)

function focusControl(target: any) {
  if (!target) return

  if (typeof target.focus === 'function') {
    target.focus()
    return
  }

  const root = target.$el as HTMLElement | undefined
  if (!root) return

  const focusable = root.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
  focusable?.focus()
}

watch(pairPlayerA, async (value, prev) => {
  if (!value || value === prev) return
  await nextTick()
  focusControl(pairPlayerBSelectRef.value)
})

watch(pairPlayerB, async (value, prev) => {
  if (!value || value === prev) return
  await nextTick()
  focusControl(addForbiddenPairButtonRef.value)
})

function notifyOptimizationResult(params: {
  changed: boolean
  beforeTotal: number
  afterTotal: number
  beforeTableTotals: number[]
  afterTableTotals: number[]
  successTitle: string
  noChangeTitle: string
}) {
  if (!params.changed || params.afterTotal <= params.beforeTotal) {
    toast.add({
      title: params.noChangeTitle,
      description: 'Non sono stati trovati miglioramenti con i vincoli correnti',
      color: 'neutral',
    })
    return
  }

  const delta = params.afterTotal - params.beforeTotal
  const changedTableNumbers = params.afterTableTotals.reduce<number[]>((acc, nextTableTotal, index) => {
    const previous = params.beforeTableTotals[index]
    if (previous === undefined) {
      acc.push(index + 1)
      return acc
    }

    if (Math.abs(nextTableTotal - previous) > 0.001) {
      acc.push(index + 1)
    }

    return acc
  }, [])

  toast.add({
    title: params.successTitle,
    description: `+${delta.toFixed(2)} punti, tavoli aggiornati: ${changedTableNumbers.join(', ') || 'nessuno'}`,
    color: 'success',
  })
}

function openTableScoreBreakdown(tableIndex: number) {
  selectedTableIndex.value = tableIndex
  showTableScoreBreakdown.value = true
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Anteprima Tavoli"
    description="Trascina i giocatori per comporre i tavoli prima di avviare l'evento"
    :dismissible="dismissible"
    :ui="{ content: 'sm:max-w-6xl', footer: 'justify-end gap-1.5' }"
  >
    <template #body>
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm text-muted">
            Punteggio totale: <span class="font-semibold text-default">{{ scoreDetails.totalScore.toFixed(2) }}</span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-settings-2" @click="showSettings = true">
              Pesi e Vincoli
            </UButton>
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-shuffle" :disabled="loading" @click="optimizeNow">
              Ottimizza
            </UButton>
          </div>
        </div>

        <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <USkeleton v-for="index in 4" :key="`table-skeleton-${index}`" class="h-48 rounded-lg" />
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <UCard
            v-for="(table, tableIndex) in localTables"
            :key="table.id"
            :class="tableCardClass(table)"
            :ui="{ header: 'px-2 py-1.5 sm:px-2 sm:py-1.5', body: 'px-2 py-2 sm:px-2 sm:py-2' }"
          >
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-grid-2x2" class="size-4 text-primary" />
                  <span class="font-semibold text-base">Tavolo {{ table.tableNumber }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-eye"
                    @click="openTableScoreBreakdown(tableIndex)"
                  >
                    Punteggio: {{ scoreDetails.tableScores[tableIndex]?.total?.toFixed(2) ?? '0.00' }}
                  </UButton>
                  <UBadge :color="tableStatus(table).color" variant="soft" size="sm" class="text-base font-semibold leading-none">
                    {{ tableStatus(table).label }}
                  </UBadge>
                </div>
              </div>
            </template>

            <VueDraggable
              v-model="table.seats"
              tag="div"
              class="grid grid-cols-2 gap-2"
              :group="{ name: 'seats', pull: true, put: true }"
              handle=".drag-handle"
              :animation="180"
              ghost-class="!opacity-0"
              chosen-class="scale-95"
              @start="handleDragStart"
              @end="handleDragEnd"
            >
              <div
                v-for="seat in visibleSeats(table)"
                :key="seat.id"
                class="rounded-md border transition-all"
                :class="seat.player
                  ? 'border-default bg-default hover:ring-2 hover:ring-amber-400 hover:shadow-md'
                  : isDragging
                    ? 'border-dashed border-amber-400 bg-amber-50 animate-pulse'
                    : 'border-dashed border-default/70 bg-muted/20'"
              >
                <div
                  v-if="seat.player"
                  class="h-full min-h-10 flex items-center gap-1.5 px-1.5 py-1"
                >
                  <button
                    type="button"
                    class="drag-handle text-muted hover:text-default transition cursor-grab hover:cursor-grab active:cursor-grabbing"
                    aria-label="Trascina giocatore"
                  >
                    <UIcon name="i-lucide-grip-vertical" class="size-4 cursor-grab hover:cursor-grab active:cursor-grabbing" />
                  </button>

                  <UAvatar
                    :src="seat.player.avatarUrl"
                    :alt="seat.player.name"
                    size="sm"
                    class="shrink-0"
                  >
                    {{ playerInitial(seat.player) }}
                  </UAvatar>

                  <span class="text-base flex-1 whitespace-normal break-words leading-tight text-left">
                    {{ playerDisplayName(seat.player).name }}
                    <span class="font-bold text-highlighted">
                      {{ ` ${playerDisplayName(seat.player).surname}` }}
                    </span>
                  </span>

                  <UBadge
                    v-if="seat.player.seed !== undefined"
                    size="sm"
                    variant="subtle"
                    color="warning"
                  >
                    #{{ seat.player.seed }}
                  </UBadge>
                </div>

                <div
                  v-else
                  class="h-full min-h-10 flex items-center justify-center gap-1.5 text-base px-1.5 py-1"
                  :class="isDragging ? 'text-amber-700' : 'text-muted'"
                >
                  <UIcon name="i-lucide-plus" class="size-4" />
                  <span>{{ isDragging ? 'Rilascia qui' : 'Slot libero' }}</span>
                </div>
              </div>
            </VueDraggable>
          </UCard>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton color="neutral" variant="ghost" size="sm" @click="handleCancel">
        Annulla
      </UButton>
      <UButton color="primary" size="sm" :disabled="!isValid" @click="handleConfirm">
        Conferma
      </UButton>
    </template>
  </UModal>

  <UModal
    v-model:open="showSettings"
    title="Pesi e Vincoli Pairing"
    description="Modifica i pesi dell'algoritmo e le coppie vietate"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-6">
        <section class="space-y-3">
          <div class="text-sm font-semibold">Pesi dell'algoritmo</div>
          <PairingPresetButtons
            :selected="selectedPreset"
            @select="applyWeightPreset"
          />

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div v-for="item in scoreItems" :key="item.key" class="space-y-1.5">
              <div class="flex items-center justify-between text-sm">
                <span>{{ item.label }}</span>
                <span class="font-mono text-xs">{{ item.value.toFixed(2) }}</span>
              </div>
              <UInputNumber
                :model-value="item.value"
                :min="item.min"
                :max="item.max"
                :step="item.step"
                class="w-full"
                @update:model-value="value => updateWeight(item.key as keyof PairingWeights, Number(value ?? 0))"
              />
            </div>
          </div>

          <div class="text-sm font-semibold">Come viene calcolato il punteggio</div>
          <div class="rounded border border-default/70 bg-muted/20 p-3 font-mono text-xs text-center">
            totale = bilanciamento_forza + novità - rematch - rotazione3 + peso_dimensione
          </div>
        </section>

        <section class="space-y-3">
          <div class="text-sm font-semibold">Coppie Vietate</div>

          <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
            <USelectMenu
              v-model="pairPlayerA"
              :items="playerOptions"
              value-key="value"
              placeholder="Giocatore A"
              :search-input="{ placeholder: 'Cerca giocatore...' }"
              ref="pairPlayerASelectRef"
            />

            <USelectMenu
              v-model="pairPlayerB"
              :items="playerOptions"
              value-key="value"
              placeholder="Giocatore B"
              :search-input="{ placeholder: 'Cerca giocatore...' }"
              ref="pairPlayerBSelectRef"
            />

            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              icon="i-lucide-plus"
              :disabled="!canAddForbiddenPair"
              ref="addForbiddenPairButtonRef"
              @click="addForbiddenPairFromSelectors"
            >
              Aggiungi coppia
            </UButton>

            <UButton size="sm" color="warning" variant="outline" icon="i-lucide-refresh-cw" @click="autoResolveConflicts">
              Risolvi conflitti
            </UButton>
          </div>

          <div class="max-h-48 overflow-auto space-y-1 pr-1">
            <div v-if="!forbiddenPairsDisplay.length" class="text-sm text-muted">
              Nessuna coppia vietata
            </div>

            <div
              v-for="pair in forbiddenPairsDisplay"
              :key="pair.key"
              class="flex items-center justify-between rounded border border-default/70 bg-muted/20 px-2 py-1.5"
            >
              <span class="text-sm">{{ pair.label }}</span>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="removeForbiddenPair(pair.playerA, pair.playerB)"
              />
            </div>
          </div>
          <div class="text-xs text-muted">
            I valori sono salvati nel LocalStorage del browser con chiave <code>pairing-preferences-event-{{ eventId }}</code>.
          </div>
        </section>
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="showTableScoreBreakdown"
    title="Dettaglio calcolo tavolo"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
        <div v-if="selectedTableScore" class="space-y-4">
          <PairingTableReceiptSummary :score="selectedTableScore" />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PairingPlayerReceiptCard
              v-for="row in selectedTablePlayerRows"
              :key="row.player.id"
              :player="row.player"
              :detail="row.detail"
            />
          </div>
      </div>

      <div v-else class="text-sm text-muted">
        Nessun dettaglio disponibile per questo tavolo.
      </div>
    </template>
  </UModal>
</template>
