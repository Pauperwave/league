import { describe, expect, it } from 'vitest'
import { buildStandingsSubmissionMap } from './standingsSubmission'

describe('buildStandingsSubmissionMap', () => {
  it('marks players as submitted when they have a ranking in current round pairings', () => {
    const pairings = [
      {
        pairing_id: 10,
        pairing_player1_id: 1,
        pairing_player2_id: 2,
        pairing_player3_id: null,
        pairing_player4_id: null,
      },
      {
        pairing_id: 20,
        pairing_player1_id: 3,
        pairing_player2_id: 4,
        pairing_player3_id: null,
        pairing_player4_id: null,
      },
    ]

    const rankingsByPairing = new Map<number, number[]>([
      [10, [1, 2]],
    ])

    const result = buildStandingsSubmissionMap(pairings, rankingsByPairing)

    expect(result.get(1)).toBe(true)
    expect(result.get(2)).toBe(true)
    expect(result.get(3)).toBe(false)
    expect(result.get(4)).toBe(false)
  })

  it('marks only ranked players as submitted for a pairing', () => {
    const pairings = [
      {
        pairing_id: 10,
        pairing_player1_id: 1,
        pairing_player2_id: 2,
        pairing_player3_id: null,
        pairing_player4_id: null,
      },
    ]

    const rankingsByPairing = new Map<number, number[]>([
      [10, [2]],
    ])

    const result = buildStandingsSubmissionMap(pairings, rankingsByPairing)

    expect(result.get(1)).toBe(false)
    expect(result.get(2)).toBe(true)
  })
})
