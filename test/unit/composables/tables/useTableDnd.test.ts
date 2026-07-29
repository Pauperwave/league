// test\unit\composables\tables\useTableDnd.test.ts
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { attemptTableSwap, useTableDnd } from '~/composables/tables/useTableDnd'
import { createI18nTestPlugin } from '#test/helpers/mocks'
import type { TournamentTable, TournamentPlayer } from '#shared/utils/types'

function player(id: number): TournamentPlayer {
  return { id, name: `P${id}`, surname: 'Test' }
}

function table(id: string, tableNumber: number, playerIds: (number | null)[]): TournamentTable {
  return {
    id,
    tableNumber,
    seats: playerIds.map((pid, index) => ({
      id: `${id}-seat-${index + 1}`,
      player: pid === null ? null : player(pid),
    })),
  }
}

const previewMessages = {
  event: {
    tablePreview: {
      invalidTableSizes: 'invalid-sizes',
      duplicatePlayers: 'duplicate-players',
      missingPlayers: 'missing-players',
      forbiddenPairsPresent: 'forbidden-pairs',
    },
  },
}

function setupTableDnd(tables: TournamentTable[], params?: Parameters<typeof useTableDnd>[1]) {
  let result!: ReturnType<typeof useTableDnd>
  mount(defineComponent({
    setup() {
      result = useTableDnd(tables, params)
      return () => h('div')
    },
  }), {
    global: { plugins: [createI18nTestPlugin(previewMessages)] },
  })
  return result
}

describe('useTableDnd', () => {
  describe('conflictingTables', () => {
    it('flags a table seating a forbidden pair together', () => {
      const tables = [
        table('t1', 1, [1, 2, 3, 4]),
        table('t2', 2, [5, 6, 7, 8]),
      ]

      const { conflictingTables } = setupTableDnd(tables, {
        initialForbiddenPairs: [{ playerA: 1, playerB: 2 }],
      })

      expect(conflictingTables.value.has('t1')).toBe(true)
      expect(conflictingTables.value.has('t2')).toBe(false)
    })

    it('reports no conflicts when no forbidden pair is seated together', () => {
      const tables = [
        table('t1', 1, [1, 2, 3, 4]),
        table('t2', 2, [5, 6, 7, 8]),
      ]

      const { conflictingTables } = setupTableDnd(tables, {
        initialForbiddenPairs: [{ playerA: 1, playerB: 5 }],
      })

      expect(conflictingTables.value.size).toBe(0)
    })
  })

  describe('previewError', () => {
    it('is empty when the arrangement is valid', () => {
      const tables = [
        table('t1', 1, [1, 2, 3, 4]),
        table('t2', 2, [5, 6, 7, 8]),
      ]

      const { previewError } = setupTableDnd(tables)

      expect(previewError.value).toBe('')
    })

    it('reports invalid table sizes when a table has fewer than 3 seated players', () => {
      const tables = [
        table('t1', 1, [1, 2, null, null]),
        table('t2', 2, [3, 4, 5, 6]),
      ]

      const { previewError } = setupTableDnd(tables)

      expect(previewError.value).toBe('invalid-sizes')
    })

    it('reports forbidden pairs when a valid-sized arrangement seats a forbidden pair together', () => {
      const tables = [
        table('t1', 1, [1, 2, 3, 4]),
        table('t2', 2, [5, 6, 7, 8]),
      ]

      const { previewError } = setupTableDnd(tables, {
        initialForbiddenPairs: [{ playerA: 1, playerB: 2 }],
      })

      expect(previewError.value).toBe('forbidden-pairs')
    })
  })

  describe('updateTableSeats', () => {
    it('re-pads a table with an empty-slot placeholder after a player is dragged out', () => {
      // Table starts full (4/4, no null seat at all) — dragging player 4 out
      // (as VueDraggable would emit) leaves only 3 occupied seats.
      const tables = [
        table('t1', 1, [1, 2, 3, 4]),
        table('t2', 2, [5, 6, 7]),
      ]
      const { updateTableSeats, localTables } = setupTableDnd(tables)

      const shrunk = localTables.value[0]!.seats.filter(s => s.player?.id !== 4)
      updateTableSeats(0, shrunk)

      const seats = localTables.value[0]!.seats
      expect(seats).toHaveLength(4)
      expect(seats.filter(s => s.player !== null).map(s => s.player!.id)).toEqual([1, 2, 3])
      // The 4th seat must be a real `player: null` placeholder — this is
      // what renders TableSeatItem.vue's "drop here" drop target; without
      // it a later cross-table drag has nowhere in the DOM to land.
      expect(seats.some(s => s.player === null)).toBe(true)
    })

    it('accepts up to 5 occupied seats mid-drag into an already-full table without dropping the incoming player', () => {
      const tables = [
        table('t1', 1, [1, 2, 3, 4]),
        table('t2', 2, [5, 6, 7]),
      ]
      const { updateTableSeats, localTables } = setupTableDnd(tables)

      const grown = [...localTables.value[0]!.seats, { id: 'incoming', player: { id: 9, name: 'P9', surname: 'Test' } }]
      updateTableSeats(0, grown)

      const seats = localTables.value[0]!.seats
      expect(seats.map(s => s.player?.id)).toEqual([1, 2, 3, 4, 9])
    })

    it('leaves an already-correctly-shaped table unchanged', () => {
      const tables = [table('t1', 1, [1, 2, null, null])]
      const { updateTableSeats, localTables } = setupTableDnd(tables)

      updateTableSeats(0, localTables.value[0]!.seats)

      const seats = localTables.value[0]!.seats
      expect(seats).toHaveLength(4)
      expect(seats.map(s => s.player?.id ?? null)).toEqual([1, 2, null, null])
    })
  })

  describe('attemptTableSwap', () => {
    function occupantIds(t: TournamentTable): number[] {
      return t.seats.map(s => s.player?.id).filter((id): id is number => id !== undefined)
    }

    it('turns a plain move into a full table into a two-way swap', () => {
      const before = [table('t1', 1, [1, 2, 3, 4]), table('t2', 2, [5, 6, 7, 8])]
      // Simulates VueDraggable's emit: player 4 dragged out of t1 (now 3
      // occupants) and appended into t2 (now 5, still holding all of 5-8).
      const after = [table('t1', 1, [1, 2, 3]), table('t2', 2, [5, 6, 7, 8, 4])]

      const result = attemptTableSwap(before, after)
      expect(result).not.toBeNull()

      const [t1, t2] = result!
      expect(occupantIds(t1!)).toHaveLength(4)
      expect(occupantIds(t2!)).toHaveLength(4)
      // Player 4 must have landed in t2 (that's the point of the drag).
      expect(occupantIds(t2!)).toContain(4)
      // Exactly one of t2's original occupants must have moved to t1.
      const swappedBack = occupantIds(t1!).filter(id => id !== 1 && id !== 2 && id !== 3)
      expect(swappedBack).toHaveLength(1)
      expect([5, 6, 7, 8]).toContain(swappedBack[0])
      // No player duplicated or lost across both tables.
      expect([...occupantIds(t1!), ...occupantIds(t2!)].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('returns null when no table is over capacity', () => {
      const before = [table('t1', 1, [1, 2, 3, 4]), table('t2', 2, [5, 6, 7, 8])]
      const after = [table('t1', 1, [1, 2, 3, 4]), table('t2', 2, [5, 6, 7, 8])]

      expect(attemptTableSwap(before, after)).toBeNull()
    })

    it('returns null when the overflow table did not exist before the drag (no baseline to diff against)', () => {
      const before = [table('t1', 1, [1, 2, 3, 4])]
      const after = [table('t1', 1, [1, 2, 3, 4, 5])]

      expect(attemptTableSwap(before, after)).toBeNull()
    })
  })

  describe('replaceByPlayerOrder (buildTablesFromOrder)', () => {
    it('reassigns seated players in the given order while preserving each table\'s occupied count', () => {
      const tables = [
        table('t1', 1, [1, 2, 3, 4]),
        table('t2', 2, [5, 6, 7]),
      ]

      const { replaceByPlayerOrder, localTables } = setupTableDnd(tables)

      // Reverse order of the 7 actually-seated players (1-4 at t1, 5-7 at t2)
      replaceByPlayerOrder([7, 6, 5, 4, 3, 2, 1])

      const seatedIds = (t: TournamentTable) => t.seats.map(s => s.player?.id).filter((id): id is number => id !== undefined)

      expect(seatedIds(localTables.value[0]!)).toEqual([7, 6, 5, 4])
      expect(seatedIds(localTables.value[1]!)).toEqual([3, 2, 1])
    })
  })

  describe('randomizeTables', () => {
    it('keeps every seated player and each table\'s occupied count, only reshuffling identities', () => {
      const tables = [
        table('t1', 1, [1, 2, 3, 4]),
        table('t2', 2, [5, 6, 7]),
      ]

      const { randomizeTables, localTables } = setupTableDnd(tables)

      randomizeTables()

      const seatedIds = (t: TournamentTable) => t.seats.map(s => s.player?.id).filter((id): id is number => id !== undefined)

      expect(seatedIds(localTables.value[0]!)).toHaveLength(4)
      expect(seatedIds(localTables.value[1]!)).toHaveLength(3)
      expect([...seatedIds(localTables.value[0]!), ...seatedIds(localTables.value[1]!)].sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
    })
  })
})
