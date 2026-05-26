import { describe, expect, it } from 'vitest'
import { getStandingsTitle, isLastRoundState } from '../../../../utils/eventFlow'

describe('event page flow helpers', () => {
  it('detects last round only when playing with valid totals', () => {
    expect(isLastRoundState('playing', 3, 3)).toBe(true)
    expect(isLastRoundState('playing', 4, 3)).toBe(true)
    expect(isLastRoundState('registration', 3, 3)).toBe(false)
    expect(isLastRoundState('playing', 2, 3)).toBe(false)
    expect(isLastRoundState('playing', 1, 0)).toBe(false)
  })

  it('builds standings titles by status and round', () => {
    expect(getStandingsTitle('ended', 3)).toBe('Classifica Finale')
    expect(getStandingsTitle('playing', 2)).toBe('Classifica Round 2')
    expect(getStandingsTitle('registration', 0)).toBe('Classifica')
  })
})
