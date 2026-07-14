// test\unit\composables\tables\useRankingGrid.test.ts
import { describe, expect, it } from 'vitest'
import { useRankingGrid, type RankingGridPlayer } from '~/composables/tables/useRankingGrid'

const fourPlayers: RankingGridPlayer[] = [
  { id: 1, name: 'Anna', surname: 'A' },
  { id: 2, name: 'Bruno', surname: 'B' },
  { id: 3, name: 'Carla', surname: 'C' },
  { id: 4, name: 'Dario', surname: 'D' },
]

describe('useRankingGrid', () => {
  it('initializes a 4x4 grid with everyone in the first row when no saved ranking', () => {
    const { grid, gridSize, initializeGrid, isValidFormation } = useRankingGrid(() => fourPlayers)
    initializeGrid()

    expect(gridSize.value).toBe(4)
    expect(grid.value[0]?.map(seat => seat?.player?.id)).toEqual([1, 2, 3, 4])
    // Everyone in row 0 = everyone tied at rank 1, which the consecutive-from-1 rule allows
    expect(isValidFormation.value).toBe(true)
  })

  it('uses a 3x3 grid for 3 players', () => {
    const { gridSize, gridRange, initializeGrid } = useRankingGrid(() => fourPlayers.slice(0, 3))
    initializeGrid()

    expect(gridSize.value).toBe(3)
    expect(gridRange.value).toEqual([0, 1, 2])
  })

  it('places players by rank from the saved ranking and extracts it back', () => {
    const saved = [
      { playerId: 1, rank: 2 },
      { playerId: 2, rank: 1 },
      { playerId: 3, rank: 4 },
      { playerId: 4, rank: 3 },
    ]
    const { initializeGrid, isValidFormation, getRanking, getRankingWithRanks } =
      useRankingGrid(() => fourPlayers, () => saved)
    initializeGrid()

    expect(isValidFormation.value).toBe(true)
    expect(getRanking()).toEqual([2, 1, 4, 3])
    expect(getRankingWithRanks()).toEqual([
      { playerId: 2, rank: 1 },
      { playerId: 1, rank: 2 },
      { playerId: 4, rank: 3 },
      { playerId: 3, rank: 4 },
    ])
  })

  it('accepts ties on the same rank as long as ranks are consecutive from 1', () => {
    const saved = [
      { playerId: 1, rank: 1 },
      { playerId: 2, rank: 1 },
      { playerId: 3, rank: 2 },
      { playerId: 4, rank: 3 },
    ]
    const { initializeGrid, isValidFormation, getRankingWithRanks } =
      useRankingGrid(() => fourPlayers, () => saved)
    initializeGrid()

    expect(isValidFormation.value).toBe(true)
    // Tied players keep column order
    expect(getRankingWithRanks()).toEqual([
      { playerId: 1, rank: 1 },
      { playerId: 2, rank: 1 },
      { playerId: 3, rank: 2 },
      { playerId: 4, rank: 3 },
    ])
  })

  it('rejects formations with rank gaps', () => {
    const saved = [
      { playerId: 1, rank: 1 },
      { playerId: 2, rank: 1 },
      { playerId: 3, rank: 3 }, // gap: no rank 2
      { playerId: 4, rank: 4 },
    ]
    const { initializeGrid, isValidFormation } = useRankingGrid(() => fourPlayers, () => saved)
    initializeGrid()

    expect(isValidFormation.value).toBe(false)
  })

  it('counts unresolvable players toward the grid size but never places them', () => {
    const withMissing = [fourPlayers[0], undefined, fourPlayers[2], fourPlayers[3]]
    const { gridSize, grid, initializeGrid, isValidFormation } = useRankingGrid(() => withMissing)
    initializeGrid()

    expect(gridSize.value).toBe(4)
    expect(grid.value[0]?.[1]).toBeNull()
    expect(isValidFormation.value).toBe(false)
  })

  it('moves a player within its column on drop and rejects cross-column drops', () => {
    const { grid, initializeGrid, handleDragStart, handleDrop } = useRankingGrid(() => fourPlayers)
    initializeGrid()

    const dragEvent = {
      preventDefault: () => {},
      dataTransfer: { setData: () => {}, dropEffect: '' },
    } as unknown as DragEvent

    // Move player in column 0 from row 0 to row 1
    handleDragStart(dragEvent, 0, 0)
    handleDrop(dragEvent, 1, 0)
    expect(grid.value[0]?.[0]).toBeNull()
    expect(grid.value[1]?.[0]?.player?.id).toBe(1)

    // Cross-column drop is a no-op
    handleDragStart(dragEvent, 0, 1)
    handleDrop(dragEvent, 0, 2)
    expect(grid.value[0]?.[1]?.player?.id).toBe(2)
    expect(grid.value[0]?.[2]?.player?.id).toBe(3)
  })
})
