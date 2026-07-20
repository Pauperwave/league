// test\unit\utils\standingsSubmission.test.ts
import { describe, expect, it } from 'vitest'
import { buildStandingsSubmissionMap } from '~/utils/standingsSubmission'

describe('buildStandingsSubmissionMap', () => {
  it('marks players as submitted when they have a ranking in current round pairings', () => {
    const pairings = [
      {
        event_id: 1,
        pairing_id: 10,
        pairing_round: 1,
        pairing_datetime: null,
        pairing_is_full: false,
        pairing_player1_id: 1,
        pairing_player2_id: 2,
        pairing_player3_id: null,
        pairing_player4_id: null,
      },
      {
        event_id: 1,
        pairing_id: 20,
        pairing_round: 1,
        pairing_datetime: null,
        pairing_is_full: false,
        pairing_player1_id: 3,
        pairing_player2_id: 4,
        pairing_player3_id: null,
        pairing_player4_id: null,
      },
    ]

    const rankingsByPairing = new Map<number, number[]>([
      [10, [1, 2]],
    ])

    const hasVotes = new Map<number, boolean>([
      [1, true], [2, true], [3, true], [4, true]
    ])

    const result = buildStandingsSubmissionMap(pairings, rankingsByPairing, hasVotes)

    expect(result.get(1)).toBe(true)
    expect(result.get(2)).toBe(true)
    expect(result.get(3)).toBe(false)
    expect(result.get(4)).toBe(false)
  })

  it('marks a pairing as not submitted if not all players are ranked', () => {
    const pairings = [
      {
        event_id: 1,
        pairing_id: 10,
        pairing_round: 1,
        pairing_datetime: null,
        pairing_is_full: false,
        pairing_player1_id: 1,
        pairing_player2_id: 2,
        pairing_player3_id: null,
        pairing_player4_id: null,
      },
    ]

    const rankingsByPairing = new Map<number, number[]>([
      [10, [2]],
    ])

    const hasVotes = new Map<number, boolean>([
      [1, true], [2, true]
    ])

    const result = buildStandingsSubmissionMap(pairings, rankingsByPairing, hasVotes)

    expect(result.get(1)).toBe(false)
    expect(result.get(2)).toBe(false)
  })
})
