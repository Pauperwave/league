// test\unit\utils\cardColors.test.ts
import { describe, it, expect } from 'vitest'
import { extractColorsFromManaCost, resolveCardColors, buildGradientClass } from '~/utils/cardColors'

describe('extractColorsFromManaCost', () => {
  it('extracts single color from a simple cost', () => {
    expect(extractColorsFromManaCost('{2}{W}')).toEqual(new Set(['W']))
  })

  it('extracts multiple colors', () => {
    expect(extractColorsFromManaCost('{1}{W}{U}{B}')).toEqual(new Set(['W', 'U', 'B']))
  })

  it('ignores the Phyrexian mana marker', () => {
    expect(extractColorsFromManaCost('{W/P}')).toEqual(new Set(['W']))
  })

  it('returns an empty set for a colorless cost', () => {
    expect(extractColorsFromManaCost('{3}')).toEqual(new Set())
  })
})

describe('resolveCardColors', () => {
  it('resolves colors from the front mana cost', () => {
    const colors = resolveCardColors({ manaCost: '{1}{R}{G}', isDoubleFaced: false, backManaCost: null, colorIdentity: [] })
    expect(colors.sort()).toEqual(['G', 'R'])
  })

  it('adds back-face colors for double-faced cards', () => {
    const colors = resolveCardColors({ manaCost: '{W}', isDoubleFaced: true, backManaCost: '{B}', colorIdentity: [] })
    expect(colors.sort()).toEqual(['B', 'W'])
  })

  it('ignores back-face mana cost when not double-faced', () => {
    const colors = resolveCardColors({ manaCost: '{W}', isDoubleFaced: false, backManaCost: '{B}', colorIdentity: [] })
    expect(colors).toEqual(['W'])
  })

  it('falls back to color identity when mana costs yield nothing', () => {
    const colors = resolveCardColors({ manaCost: null, isDoubleFaced: false, backManaCost: null, colorIdentity: ['U', 'B'] })
    expect(colors.sort()).toEqual(['B', 'U'])
  })

  it('falls back to colorless when there is no mana cost or color identity', () => {
    const colors = resolveCardColors({ manaCost: null, isDoubleFaced: false, backManaCost: null, colorIdentity: [] })
    expect(colors).toEqual(['C'])
  })
})

describe('buildGradientClass', () => {
  it('builds a single-color radial-style gradient', () => {
    expect(buildGradientClass(['W'])).toBe('bg-gradient-to-br from-amber-100 via-amber-100 to-transparent')
  })

  it('builds a two-color gradient', () => {
    expect(buildGradientClass(['W', 'U'])).toBe('bg-gradient-to-br from-amber-100 to-blue-600')
  })

  it('builds a three-color gradient', () => {
    expect(buildGradientClass(['W', 'U', 'B'])).toBe('bg-gradient-to-r from-amber-100 via-blue-600 to-gray-950')
  })

  it('falls back to the generic multicolor gradient for 4+ colors', () => {
    expect(buildGradientClass(['W', 'U', 'B', 'R'])).toBe('bg-gradient-to-br from-amber-200 via-amber-200 to-transparent')
  })

  it('falls back to the colorless mapping for an unknown color letter', () => {
    expect(buildGradientClass(['X'])).toBe('bg-gradient-to-br from-gray-300 via-gray-300 to-transparent')
  })
})
