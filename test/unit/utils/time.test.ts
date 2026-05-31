import { describe, it, expect } from 'vitest'
import { formatDuration } from '~/utils/time'

describe('formatDuration', () => {
  it.each([
    [0, '00:00'],
    [65, '01:05'],
    [3600, '1:00:00'],
    [3661, '1:01:01'],
  ])('formatDuration(%i) → "%s"', (input, expected) => {
    expect(formatDuration(input)).toBe(expected)
  })
})
