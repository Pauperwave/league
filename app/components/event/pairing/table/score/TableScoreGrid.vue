<!-- app\components\event\pairing\table\score\TableScoreGrid.vue -->
<script setup lang="ts">
import type { Pairing } from '#shared/utils/types'
import TableSeatItem from '../TableSeatItem.vue'
import type { RankingGridPlayer } from '~/composables/tables/useRankingGrid'

const { t } = useI18n()

interface DatabasePlayer {
  player_id: number
  player_name: string
  player_surname: string
  formats_played: string[] | null
  is_active: boolean
}

const props = defineProps<{
  pairing: Pairing | null
  allPlayers: DatabasePlayer[]
  savedRankingWithRanks?: { playerId: number; rank: number }[]
}>()

const emit = defineEmits<{
  submit: [ranking: number[], rankingWithRanks: { playerId: number; rank: number }[]]
  cancel: []
}>()

const players = computed(() => {
  if (!props.pairing) return []
  return (
    [
      props.pairing.pairing_player1_id,
      props.pairing.pairing_player2_id,
      props.pairing.pairing_player3_id,
      props.pairing.pairing_player4_id,
    ] as (number | null | undefined)[]
  ).filter((id): id is number => id !== null && id !== undefined)
})

const gridPlayers = computed<(RankingGridPlayer | undefined)[]>(() =>
  players.value.map((playerId) => {
    const player = props.allPlayers.find((p) => p.player_id === playerId)
    if (!player) return undefined
    return {
      id: player.player_id,
      name: player.player_name,
      surname: player.player_surname,
    }
  })
)

const {
  grid,
  gridSize,
  gridRange,
  isDragging,
  draggedFromCol,
  isValidFormation,
  initializeGrid,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  getRanking,
  getRankingWithRanks,
} = useRankingGrid(() => gridPlayers.value, () => props.savedRankingWithRanks)

watch(() => props.pairing, initializeGrid, { immediate: true })

const confirmRankingLogging = useButtonLogging('Conferma classifica', {
  isValidFormation: () => isValidFormation.value,
  playerCount: () => players.value.length,
  gridSize: () => gridSize.value,
})

function handleSubmit() {
  confirmRankingLogging.logClick()
  if (!isValidFormation.value) {
    return
  }
  const ranking = getRanking()
  const rankingWithRanks = getRankingWithRanks()
  emit('submit', ranking, rankingWithRanks)
}

function handleCancel() {
  console.log('Score modal cancelled (Cancel clicked)')
  emit('cancel')
}

function getCellClass(row: number, col: number): string {
  const seat = grid.value[row]?.[col] ?? null
  const base = 'min-w-32 h-12 rounded-md border transition-all flex items-center justify-center'

  // During drag, highlight only cells in the same column
  const isSameColumn = isDragging.value && draggedFromCol.value === col

  if (seat !== null) {
    return `${base} border-default bg-default hover:ring-2 hover:ring-amber-400 hover:shadow-md`
  }

  // Empty cell - highlight if same column during drag
  if (isSameColumn) {
    return `${base} border-dashed border-amber-400 bg-amber-50`
  }

  return `${base} border-dashed border-default/70 bg-muted/20`
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted-foreground">
      {{ t('event.scoreGrid.instructions') }}
    </p>

    <div
      class="grid gap-2"
      :class="gridSize === 3 ? 'grid-cols-3' : 'grid-cols-4'"
    >
      <template v-for="row in gridRange" :key="`row-${row}`">
        <template v-for="col in gridRange" :key="`row-${row}-col-${col}`">
          <div
            :class="getCellClass(row, col)"
            @dragover="handleDragOver"
            @drop="handleDrop($event, row, col)"
          >
            <!--
              ✅ draggable="true" is on this wrapper div, NOT on TableSeatItem.
              The dragstart/dragend events are here too, receiving the native event.
            -->
            <div
              v-if="grid[row]?.[col]"
              draggable="true"
              class="w-full h-full cursor-grab active:cursor-grabbing"
              @dragstart="handleDragStart($event, row, col)"
              @dragend="handleDragEnd"
            >
              <TableSeatItem
                :seat="grid[row]![col]!"
                :is-dragging="isDragging"
              />
            </div>
          </div>
        </template>
      </template>
    </div>

    <!-- Actions -->
    <ModalFooterActions
      :confirm-label="t('event.scoreGrid.confirmRanking')"
      :confirm-disabled="!isValidFormation"
      @cancel="handleCancel"
      @confirm="handleSubmit"
    />
  </div>
</template>
