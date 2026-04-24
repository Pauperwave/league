<script setup lang="ts">
import type { Pairing, Seat } from '#shared/utils/types'
import TableSeatItem from './Table/TableSeatItem.vue'
import { useButtonLogging } from '~/composables/useButtonLogging'

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
  savedRankingWithRanks?: { playerId: number; rank: number }[] // Ranking salvato con rank effettivi
}

const props = defineProps<Props>()

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

const gridSize = computed(() => (players.value.length === 3 ? 3 : 4))
const gridRange = computed(() => Array.from({ length: gridSize.value }, (_, i) => i))

// Formation represents the ranking positions: e.g., 1-2-3-4 means 1st, 2nd, 3rd, 4th place
// Rule: ranks used must form a consecutive sequence starting from 1 (no gaps)
const isValidFormation = computed(() => {
  const size = gridSize.value

  // Per ogni colonna (giocatore), trova in quale riga (rank) si trova
  const formation: (number | null)[] = Array(size).fill(null)
  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size; row++) {
      if (grid.value[row]?.[col]) {
        formation[col] = row + 1
        break
      }
    }
  }

  // Tutti i giocatori devono essere posizionati
  if (formation.some(r => r === null)) return false

  // I rank usati devono essere consecutivi a partire da 1 (niente buchi)
  const uniqueRanks = [...new Set(formation as number[])].sort((a, b) => a - b)
  const isValid = uniqueRanks.every((rank, i) => rank === i + 1)

  console.log('[VALID FORMATION] Formation:', formation)
  console.log('[VALID FORMATION] Unique ranks:', uniqueRanks)
  console.log('[VALID FORMATION] Is valid:', isValid)

  return isValid
})

const grid = ref<(Seat | null)[][]>([])

const isDragging = ref(false)
const draggedFromCell = ref<{ row: number; col: number } | null>(null)
const draggedFromCol = ref<number | null>(null)

function getPlayerById(playerId: number): DatabasePlayer | undefined {
  return props.allPlayers.find((p) => p.player_id === playerId)
}

function initializeGrid() {
  const size = gridSize.value
  const newGrid: (Seat | null)[][] = Array.from({ length: size }, () =>
    Array<Seat | null>(size).fill(null)
  )

  if (props.savedRankingWithRanks && props.savedRankingWithRanks.length > 0) {
    // Usa il ranking salvato con rank effettivi per posizionare i giocatori
    const savedRanking = props.savedRankingWithRanks
    players.value.forEach((playerId, colIndex) => {
      const player = getPlayerById(playerId)
      if (!player) return

      // Trova il rank di questo giocatore nel ranking salvato
      const savedEntry = savedRanking.find(entry => entry.playerId === playerId)
      if (!savedEntry) return

      // Posiziona il giocatore nella riga corrispondente al suo rank (rank 1 → row 0)
      const row = savedEntry.rank - 1
      if (row >= 0 && row < size && newGrid[row]) {
        newGrid[row][colIndex] = {
          id: `grid-seat-${colIndex}`,
          player: {
            id: player.player_id,
            name: player.player_name,
            surname: player.player_surname,
            seed: undefined,
            avatarUrl: undefined,
          },
        }
      }
    })
  } else {
    // Posiziona tutti nella prima riga (default)
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
  }

  grid.value = newGrid
}

watch(() => props.pairing, initializeGrid, { immediate: true })

// Set the dataTransfer so the browser knows a drag is happening
function handleDragStart(event: DragEvent, row: number, col: number) {
  isDragging.value = true
  draggedFromCell.value = { row, col }
  draggedFromCol.value = col
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
  draggedFromCol.value = null
}

function getRanking(): number[] {
  const size = gridSize.value
  const result: { playerId: number; rank: number; col: number }[] = []

  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size; row++) {
      const seat = grid.value[row]?.[col]
      if (seat?.player) {
        result.push({ playerId: seat.player.id, rank: row + 1, col })
        break
      }
    }
  }

  // Sort by rank, then by column to maintain order for same ranks
  result.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return a.col - b.col
  })
  return result.map(r => r.playerId)
}

function getRankingWithRanks(): { playerId: number; rank: number }[] {
  const size = gridSize.value
  const result: { playerId: number; rank: number; col: number }[] = []

  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size; row++) {
      const seat = grid.value[row]?.[col]
      if (seat?.player) {
        result.push({ playerId: seat.player.id, rank: row + 1, col })
        break
      }
    }
  }

  // Sort by rank, then by column to maintain order for same ranks
  result.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return a.col - b.col
  })
  return result.map(r => ({ playerId: r.playerId, rank: r.rank }))
}

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
  console.log('Score modal cancelled (Annulla clicked)')
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
