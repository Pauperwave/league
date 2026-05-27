import { describe, expect, it } from 'vitest'
import { buildStandingsSubmissionMap } from '../../../../utils/standingsSubmission'

describe('event flow helpers', () => {
  it('builds a submission map for current round pairings', () => {
    const pairings = [
      {
        pairing_id: 1,
        pairing_player1_id: 10,
        pairing_player2_id: 11,
        pairing_player3_id: null,
        pairing_player4_id: null,
      },
      {
        pairing_id: 2,
        pairing_player1_id: 12,
        pairing_player2_id: 13,
        pairing_player3_id: null,
        pairing_player4_id: null,
      },
    ]

    const rankingsByPairing = new Map<number, number[]>([
      [1, [10, 11]],
    ])

    const submitted = buildStandingsSubmissionMap(pairings, rankingsByPairing)

    expect(submitted.get(10)).toBe(true)
    expect(submitted.get(11)).toBe(true)
    expect(submitted.get(12)).toBe(false)
    expect(submitted.get(13)).toBe(false)
  })
})
