// test\unit\composables\tables\useTableCalculator.test.ts
import { describe, expect, it } from 'vitest'
import { useTableCalculator } from '~/composables/tables/useTableCalculator'

describe('useTableCalculator', () => {
  const { calculateTables, getTableSizes, buildPreviewTables, formatTableEstimate } = useTableCalculator()

  describe('calculateTables', () => {
    it('rejects fewer than 3 players', () => {
      expect(calculateTables(2)).toEqual({ canPlay: false, tables4: 0, tables3: 0 })
    })

    it('rejects exactly 5 players (unsplittable into 3s/4s)', () => {
      expect(calculateTables(5)).toEqual({ canPlay: false, tables4: 0, tables3: 0 })
    })

    it('splits an exact multiple of 4 into all 4-player tables', () => {
      expect(calculateTables(8)).toEqual({ canPlay: true, tables4: 2, tables3: 0 })
    })

    it('splits 6 players into two 3-player tables', () => {
      expect(calculateTables(6)).toEqual({ canPlay: true, tables4: 0, tables3: 2 })
    })

    it('mixes 4- and 3-player tables for 11 players', () => {
      expect(calculateTables(11)).toEqual({ canPlay: true, tables4: 2, tables3: 1 })
    })
  })

  describe('getTableSizes', () => {
    it('returns an empty array for an invalid count', () => {
      expect(getTableSizes(5)).toEqual([])
    })

    it('returns one size entry per table, largest first', () => {
      expect(getTableSizes(7)).toEqual([4, 3])
    })
  })

  describe('buildPreviewTables', () => {
    it('slices player ids into tables preserving order', () => {
      expect(buildPreviewTables([1, 2, 3, 4, 5, 6, 7])).toEqual([[1, 2, 3, 4], [5, 6, 7]])
    })

    it('returns an empty array for an invalid player count', () => {
      expect(buildPreviewTables([1, 2, 3, 4, 5])).toEqual([])
    })
  })

  describe('formatTableEstimate', () => {
    const format = (count: number, size: 4 | 3) => `${count} da ${size}`

    it('joins both sizes with the conjunction when both are present', () => {
      expect(formatTableEstimate(2, 1, format, 'e')).toBe('2 da 4 e 1 da 3')
    })

    it('omits a size with zero tables', () => {
      expect(formatTableEstimate(2, 0, format, 'e')).toBe('2 da 4')
      expect(formatTableEstimate(0, 3, format, 'e')).toBe('3 da 3')
    })

    it('returns an empty string when there are no tables at all', () => {
      expect(formatTableEstimate(0, 0, format, 'e')).toBe('')
    })
  })
})
