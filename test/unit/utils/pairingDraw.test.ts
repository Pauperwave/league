// test\unit\utils\pairingDraw.test.ts
import { describe, expect, it } from 'vitest'
import { isPairingDraw } from '~/utils/pairingDraw'
import type { PairingWithResults, RoundResult } from '#shared/utils/types'

function makePairing(round_results: PairingWithResults['round_results']): PairingWithResults {
  return {
    event_id: 1,
    pairing_id: 1,
    pairing_round: 1,
    pairing_datetime: null,
    pairing_is_full: true,
    pairing_player1_id: 1,
    pairing_player2_id: 2,
    pairing_player3_id: 3,
    pairing_player4_id: 4,
    round_results,
  }
}

function makeResult(overrides: Partial<RoundResult>): RoundResult {
  return {
    id: 0,
    pairing_id: 1,
    player_id: 1,
    position: 1,
    number_of_kills: 0,
    brew_vote: null,
    play_vote_1: null,
    play_vote_2: null,
    commander_1: null,
    commander_2: null,
    ...overrides,
  }
}

describe('isPairingDraw', () => {
  it('is true when every seated player has zero kills and all tie for rank 1', () => {
    const pairing = makePairing([1, 2, 3, 4].map(playerId => makeResult({ player_id: playerId, number_of_kills: 0 })))
    const ranking = [1, 2, 3, 4].map(playerId => ({ playerId, rank: 1 }))

    expect(isPairingDraw(pairing, ranking)).toBe(true)
  })

  it('is false when someone scored a kill', () => {
    const pairing = makePairing([
      makeResult({ player_id: 1, number_of_kills: 1 }),
      makeResult({ player_id: 2, number_of_kills: 0 }),
    ])
    const ranking = [{ playerId: 1, rank: 1 }, { playerId: 2, rank: 1 }]

    expect(isPairingDraw(pairing, ranking)).toBe(false)
  })

  it('is false when not everyone ties for rank 1', () => {
    const pairing = makePairing([
      makeResult({ player_id: 1, number_of_kills: 0 }),
      makeResult({ player_id: 2, number_of_kills: 0 }),
    ])
    const ranking = [{ playerId: 1, rank: 1 }, { playerId: 2, rank: 2 }]

    expect(isPairingDraw(pairing, ranking)).toBe(false)
  })

  it('is false when ranking is missing or empty', () => {
    const pairing = makePairing([makeResult({ player_id: 1, number_of_kills: 0 })])

    expect(isPairingDraw(pairing, undefined)).toBe(false)
    expect(isPairingDraw(pairing, [])).toBe(false)
  })

  it('is false when there are no round results yet', () => {
    const pairing = makePairing([])
    expect(isPairingDraw(pairing, [{ playerId: 1, rank: 1 }])).toBe(false)
  })
})
