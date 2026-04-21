<script setup lang="ts">
import type { Pairing, Seat } from '#shared/utils/types'
import TableSeatItem from './Table/TableSeatItem.vue'

interface DatabasePlayer {
  player_id: number
  player_name: string
  player_surname: string
  formats_played: string[] | null
  is_active: boolean
}

interface Props {
  pairing: Pairing | null
  getPlayerName: (playerId: number) => string
  allPlayers: DatabasePlayer[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: [ranking: number[]]
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

const gridSize = computed(() => (players.value.length === 3 ? 3 : 4))
const gridRange = computed(() => Array.from({ length: gridSize.value }, (_, i) => i))

// Valid formations for 4 players: 1-1-1-1 (draw), 1-2-2-2, 1-2-3-3, 1-2-3-4
// Valid formations for 3 players: 1-1-1 (draw), 1-2-2, 1-2-3
// Formation represents the ranking positions: e.g., 1-2-3-4 means 1st, 2nd, 3rd, 4th place
const isValidFormation = computed(() => {
  const size = gridSize.value

  // Count players in each row (each row represents a ranking position)
  const rowCounts: number[] = []
  for (let row = 0; row < size; row++) {
    let count = 0
    for (let col = 0; col < size; col++) {
      if (grid.value[row]?.[col]) count++
    }
    rowCounts.push(count)
  }

  // Remove trailing zeros (empty rows at the bottom)
  while (rowCounts.length > 0 && rowCounts[rowCounts.length - 1] === 0) {
    rowCounts.pop()
  }

  if (size === 3) {
    const validFormations = [
      [1, 1, 1],
      [1, 1, 2],
      [1, 2, 2],
      [1, 2, 3],
    ]
    return validFormations.some(formation =>
      JSON.stringify(rowCounts) === JSON.stringify(formation)
    )
  }

  if (size === 4) {
    const validFormations = [
      [1, 1, 1, 1],
      [1, 1, 1, 2],
      [1, 1, 2, 2],
      [1, 1, 2, 3],
      [1, 2, 2, 2],
      [1, 2, 2, 3],
      [1, 2, 3, 3],
      [1, 2, 3, 4],
    ]
    return validFormations.some(formation =>
      JSON.stringify(rowCounts) === JSON.stringify(formation)
    )
  }

  return false
})

const grid = ref<(Seat | null)[][]>([])

const isDragging = ref(false)
const draggedFromCell = ref<{ row: number; col: number } | null>(null)

function getPlayerById(playerId: number): DatabasePlayer | undefined {
  return props.allPlayers.find((p) => p.player_id === playerId)
}

function initializeGrid() {
  const size = gridSize.value
  const newGrid: (Seat | null)[][] = Array.from({ length: size }, () =>
    Array<Seat | null>(size).fill(null)
  )

  const firstRow = newGrid[0]
  if (!firstRow) return

  players.value.forEach((playerId, i) => {
    if (i >= size) return
    const player = getPlayerById(playerId)
    if (!player) return
    firstRow[i] = {
      id: `grid-seat-${i}`,
      player: {
        id: player.player_id,
        name: player.player_name,
        surname: player.player_surname,
        seed: undefined,
        avatarUrl: undefined,
      },
    }
  })

  grid.value = newGrid
}

watch(() => props.pairing, initializeGrid, { immediate: true })

// ✅ Set the dataTransfer so the browser knows a drag is happening
function handleDragStart(event: DragEvent, row: number, col: number) {
  isDragging.value = true
  draggedFromCell.value = { row, col }
  // Required: without this, Firefox won't fire drop at all
  event.dataTransfer?.setData('text/plain', `${row},${col}`)
}

function handleDragOver(event: DragEvent) {
  // Required: prevents the browser's default "no drop" behaviour
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function handleDrop(event: DragEvent, row: number, col: number) {
  event.preventDefault()
  if (!draggedFromCell.value) return

  const { row: fromRow, col: fromCol } = draggedFromCell.value
  if (fromRow === row && fromCol === col) return

  // Constraint: players can only be dropped in the same column
  if (fromCol !== col) return

  // ✅ Deep copy → triggers Vue reactivity properly
  const newGrid = grid.value.map((r) => [...r])
  const fromSeat = newGrid[fromRow]?.[fromCol] ?? null
  const toSeat = newGrid[row]?.[col] ?? null

  if (newGrid[row]) newGrid[row]![col] = fromSeat
  if (newGrid[fromRow]) newGrid[fromRow]![fromCol] = toSeat

  grid.value = newGrid

  isDragging.value = false
  draggedFromCell.value = null
}

function handleDragEnd() {
  isDragging.value = false
  draggedFromCell.value = null
}

function getRanking(): number[] {
  const ranking: number[] = []
  for (const row of grid.value) {
    for (const seat of row) {
      if (seat?.player) ranking.push(seat.player.id)
    }
  }
  return ranking
}

function handleSubmit() {
  if (!isValidFormation.value) {
    return
  }
  emit('submit', getRanking())
}

function handleCancel() {
  emit('cancel')
}

function getCellClass(row: number, col: number): string {
  const seat = grid.value[row]?.[col] ?? null
  const base = 'w-24 h-16 rounded-md border transition-all flex items-center justify-center'
  return seat !== null
    ? `${base} border-default bg-default hover:ring-2 hover:ring-amber-400 hover:shadow-md`
    : `${base} border-dashed border-default/70 bg-muted/20`
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted-foreground">
      Trascina le chip dei giocatori per definire l'ordine di classifica (da sinistra a destra,
      dall'alto in basso)
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
    <div class="flex gap-2 justify-end">
      <UButton color="neutral" variant="outline" @click="handleCancel">
        Annulla
      </UButton>
      <UButton
        color="primary"
        :disabled="!isValidFormation"
        @click="handleSubmit"
      >
        Conferma Classifica
      </UButton>
    </div>
  </div>
</template>
