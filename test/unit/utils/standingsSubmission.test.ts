// test\unit\utils\standingsSubmission.test.ts
import { describe, expect, it } from 'vitest'
import { buildStandingsSubmissionMap, hasCompleteRanking } from '~/utils/standingsSubmission'

describe('hasCompleteRanking', () => {
  it('is false when no one has been ranked yet', () => {
    expect(hasCompleteRanking([1, 2, 3, 4], [])).toBe(false)
  })

  it('is false when only some seated players have been ranked', () => {
    expect(hasCompleteRanking([1, 2, 3, 4], [1, 2])).toBe(false)
  })

  it('is true once every seated player has been ranked, regardless of extra order', () => {
    expect(hasCompleteRanking([1, 2, 3, 4], [4, 2, 1, 3])).toBe(true)
  })
})

describe('buildStandingsSubmissionMap', () => {
  it('fans a per-pairing completeness map out to every seated player', () => {
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

    const isCompleteByPairing = new Map<number, boolean>([
      [10, true],
      [20, false],
    ])

    const result = buildStandingsSubmissionMap(pairings, isCompleteByPairing)

    expect(result.get(1)).toBe(true)
    expect(result.get(2)).toBe(true)
    expect(result.get(3)).toBe(false)
    expect(result.get(4)).toBe(false)
  })

  it('treats a pairing missing from the completeness map as not submitted', () => {
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

    const result = buildStandingsSubmissionMap(pairings, new Map())

    expect(result.get(1)).toBe(false)
    expect(result.get(2)).toBe(false)
  })
})
