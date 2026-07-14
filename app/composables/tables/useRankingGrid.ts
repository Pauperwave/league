// app\composables\tables\useRankingGrid.ts
import { computed, ref } from 'vue'
import type { Seat } from '#shared/utils/types'

export interface RankingGridPlayer {
  id: number
  name: string
  surname: string
}

interface RankEntry { playerId: number; rank: number; col: number }

/**
 * Drag-and-drop ranking grid state for TableScoreGrid: a size×size grid where
 * each column is a player and the row they occupy is their rank (row 0 = 1st).
 * Players can only be moved vertically within their own column, and the ranks
 * used must form a consecutive sequence starting from 1 (ties share a row).
 *
 * `players` may contain `undefined` entries (player ids with no matching
 * player record): they still count toward the grid size but are never placed,
 * which keeps the formation invalid until the data is fixed.
 */
export function useRankingGrid(
  players: () => (RankingGridPlayer | undefined)[],
  savedRankingWithRanks?: () => { playerId: number; rank: number }[] | undefined
) {
  const grid = ref<(Seat | null)[][]>([])

  const isDragging = ref(false)
  const draggedFromCell = ref<{ row: number; col: number } | null>(null)
  const draggedFromCol = ref<number | null>(null)

  const gridSize = computed(() => (players().length === 3 ? 3 : 4))
  const gridRange = computed(() => Array.from({ length: gridSize.value }, (_, i) => i))

  // Formation represents the ranking positions: e.g., 1-2-3-4 means 1st, 2nd, 3rd, 4th place
  // Rule: ranks used must form a consecutive sequence starting from 1 (no gaps)
  const isValidFormation = computed(() => {
    const size = gridSize.value

    // For each column (player), find which row (rank) it's in
    const formation: (number | null)[] = Array(size).fill(null)
    for (let col = 0; col < size; col++) {
      for (let row = 0; row < size; row++) {
        if (grid.value[row]?.[col]) {
          formation[col] = row + 1
          break
        }
      }
    }

    // All players must be placed
    if (formation.some(r => r === null)) return false

    // Ranks used must be consecutive starting from 1 (no gaps)
    const uniqueRanks = [...new Set(formation as number[])].sort((a, b) => a - b)
    const isValid = uniqueRanks.every((rank, i) => rank === i + 1)

    console.log('[VALID FORMATION] Formation:', formation)
    console.log('[VALID FORMATION] Unique ranks:', uniqueRanks)
    console.log('[VALID FORMATION] ✅ Is valid:', isValid)

    return isValid
  })

  function toSeat(player: RankingGridPlayer, col: number): Seat {
    return {
      id: `grid-seat-${col}`,
      player: {
        id: player.id,
        name: player.name,
        surname: player.surname,
        seed: undefined,
        avatarUrl: undefined,
      },
    }
  }

  function initializeGrid() {
    const size = gridSize.value
    const newGrid: (Seat | null)[][] = Array.from({ length: size }, () =>
      Array<Seat | null>(size).fill(null)
    )
    const saved = savedRankingWithRanks?.()

    if (saved && saved.length > 0) {
      // Use the saved ranking with actual ranks to place players
      players().forEach((player, colIndex) => {
        if (!player) return

        // Find this player's rank in the saved ranking
        const savedEntry = saved.find(entry => entry.playerId === player.id)
        if (!savedEntry) return

        // Place the player in the row matching their rank (rank 1 → row 0)
        const row = savedEntry.rank - 1
        if (row >= 0 && row < size && newGrid[row]) {
          newGrid[row][colIndex] = toSeat(player, colIndex)
        }
      })
    } else {
      // Place everyone in the first row (default)
      const firstRow = newGrid[0]
      if (!firstRow) return

      players().forEach((player, i) => {
        if (i >= size || !player) return
        firstRow[i] = toSeat(player, i)
      })
    }

    grid.value = newGrid
  }

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

    // Deep copy → triggers Vue reactivity properly
    const newGrid = grid.value.map((r) => [...r])
    const fromSeat = newGrid[fromRow]?.[fromCol] ?? null
    const toSeatValue = newGrid[row]?.[col] ?? null

    if (newGrid[row]) newGrid[row]![col] = fromSeat
    if (newGrid[fromRow]) newGrid[fromRow]![fromCol] = toSeatValue

    grid.value = newGrid

    isDragging.value = false
    draggedFromCell.value = null
  }

  function handleDragEnd() {
    isDragging.value = false
    draggedFromCell.value = null
    draggedFromCol.value = null
  }

  /** Extract ranked players from the grid, sorted by rank then column */
  function extractRankedPlayers(): RankEntry[] {
    const size = gridSize.value
    const result: RankEntry[] = []

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

    return result
  }

  function getRanking(): number[] {
    return extractRankedPlayers().map(r => r.playerId)
  }

  function getRankingWithRanks(): { playerId: number; rank: number }[] {
    return extractRankedPlayers().map(r => ({ playerId: r.playerId, rank: r.rank }))
  }

  return {
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
  }
}
