import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useTableDnd } from '~/composables/tables/useTableDnd'
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
})
