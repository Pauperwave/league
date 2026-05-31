import { describe, it, expect } from 'vitest'
import { roundToDecimals, isCloseTo } from '~/utils/math'

describe('roundToDecimals', () => {
  it('arrotonda a 2 decimali', () => {
    expect(roundToDecimals(1.234, 2)).toBe(1.23)
  })

  it('arrotonda a 1 decimale', () => {
    expect(roundToDecimals(1.25, 1)).toBe(1.3)
  })
})

describe('isCloseTo', () => {
  it('gestisce i floating point errors', () => {
    expect(isCloseTo(0.1 + 0.2, 0.3)).toBe(true)
  })

  it('ritorna false per valori distanti', () => {
    expect(isCloseTo(1, 2)).toBe(false)
  })
})
