// test\unit\utils\roundTimer.test.ts
import { describe, it, expect } from 'vitest'
import {
  calculateTotalSeconds,
  calculateRemainingSeconds,
  isTimerExpired,
  isTimerPaused,
  calculateResumeStartTime,
  clampSubtractedBonus,
  wouldSubtractExpireTimer,
} from '~/utils/roundTimer'

describe('calculateTotalSeconds', () => {
  it('converts base + bonus minutes to seconds', () => {
    expect(calculateTotalSeconds(50, 0)).toBe(3000)
    expect(calculateTotalSeconds(50, 10)).toBe(3600)
  })

  it('supports a negative bonus (time removed)', () => {
    expect(calculateTotalSeconds(50, -10)).toBe(2400)
  })
})

describe('calculateRemainingSeconds', () => {
  it('subtracts elapsed from total', () => {
    expect(calculateRemainingSeconds(3000, 1000)).toBe(2000)
  })

  it('clamps at 0 instead of going negative once elapsed exceeds total', () => {
    expect(calculateRemainingSeconds(3000, 5000)).toBe(0)
  })

  it('returns the full total when nothing has elapsed', () => {
    expect(calculateRemainingSeconds(3000, 0)).toBe(3000)
  })
})

describe('isTimerExpired', () => {
  it('is true only at exactly 0 remaining', () => {
    expect(isTimerExpired(0)).toBe(true)
    expect(isTimerExpired(1)).toBe(false)
  })
})

describe('isTimerPaused', () => {
  it('is false when running, regardless of other state', () => {
    expect(isTimerPaused(true, true, false)).toBe(false)
  })

  it('is false when never started (fresh timer)', () => {
    expect(isTimerPaused(false, false, false)).toBe(false)
  })

  it('is false once expired, even if not running', () => {
    expect(isTimerPaused(false, true, true)).toBe(false)
  })

  it('is true only when stopped, started at least once, and not expired', () => {
    expect(isTimerPaused(false, true, false)).toBe(true)
  })
})

describe('calculateResumeStartTime', () => {
  it('back-dates the start time by the elapsed duration', () => {
    const now = 1_000_000
    expect(calculateResumeStartTime(now, 30)).toBe(now - 30_000)
  })

  it('returns now unchanged when resuming from zero elapsed', () => {
    const now = 1_000_000
    expect(calculateResumeStartTime(now, 0)).toBe(now)
  })
})

describe('clampSubtractedBonus', () => {
  it('subtracts minutes from the current bonus', () => {
    expect(clampSubtractedBonus(10, 5, 50)).toBe(5)
  })

  it('floors the bonus so total duration never drops below zero', () => {
    // durationMinutes=50, bonus already at -40 (10 min total remaining):
    // subtracting another 15 would bring total to -5 minutes — clamp to -50.
    expect(clampSubtractedBonus(-40, 15, 50)).toBe(-50)
  })

  it('clamps exactly at the boundary (total would hit zero)', () => {
    expect(clampSubtractedBonus(0, 50, 50)).toBe(-50)
  })
})

describe('wouldSubtractExpireTimer', () => {
  it('is true when the subtraction lands remaining exactly at 0', () => {
    // 50 min duration, 45 min (2700s) elapsed → 5 min left. Subtracting 5
    // brings total down to 45 min, matching elapsed exactly.
    expect(wouldSubtractExpireTimer(2700, 0, 5, 50)).toBe(true)
  })

  it('is false when time remains after the subtraction', () => {
    expect(wouldSubtractExpireTimer(2700, 0, 1, 50)).toBe(false)
  })

  it('is false when the timer is already expired — not a new consequence', () => {
    expect(wouldSubtractExpireTimer(3000, 0, 5, 50)).toBe(false)
  })

  it('is true when the subtraction is clamped but the clamped total still expires it', () => {
    // Subtracting far more than the round's own duration clamps the bonus
    // at -durationMinutes, zeroing the total outright.
    expect(wouldSubtractExpireTimer(0, 0, 100, 50)).toBe(true)
  })
})
