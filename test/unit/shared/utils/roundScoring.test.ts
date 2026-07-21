// test\unit\shared\utils\roundScoring.test.ts
import { describe, expect, it } from 'vitest'
import { buildPairingRows, buildRoundOneTables, calculateRoundScores } from '#shared/utils/roundScoring'
import type { Pairing, RoundResult, Ruleset } from '#shared/utils/types'
import type { StandingAccumulator } from '#shared/utils/roundScoring'

function makeRuleset(overrides: Partial<Ruleset> = {}): Ruleset {
  return {
    ruleset_id: 1,
    name: 'Test Ruleset',
    rule_set_rank1: 4,
    rule_set_rank2: 3,
    rule_set_rank3: 2,
    rule_set_rank4: 1,
    rule_set_kill: 1,
    rule_set_brew: 1,
    rule_set_play: 1,
    rule_set_partecipation: 0,
    rule_set_valid_events: null,
    ...overrides,
  }
}

function makePairing(overrides: Partial<Pairing> = {}): Pairing {
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
    ...overrides,
  }
}

function makeResult(overrides: Partial<RoundResult> = {}): RoundResult {
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

function makeStandingsMap(playerIds: number[]): Map<number, StandingAccumulator> {
  return new Map(playerIds.map(id => [id, {
    player_id: id,
    standing_player_score: 0,
    victories: 0,
    brew_received: 0,
    play_received: 0,
  }]))
}

describe('buildRoundOneTables', () => {
  it('splits an exact multiple of 4 into all 4-player tables', () => {
    const tables = buildRoundOneTables([1, 2, 3, 4, 5, 6, 7, 8])
    expect(tables).toEqual([[1, 2, 3, 4], [5, 6, 7, 8]])
  })

  it('splits 3 players into a single 3-player table', () => {
    expect(buildRoundOneTables([1, 2, 3])).toEqual([[1, 2, 3]])
  })

  it('splits 6 players into two 3-player tables', () => {
    expect(buildRoundOneTables([1, 2, 3, 4, 5, 6])).toEqual([[1, 2, 3], [4, 5, 6]])
  })

  it('mixes 4- and 3-player tables for a count not divisible by 4', () => {
    const tables = buildRoundOneTables([1, 2, 3, 4, 5, 6, 7])
    expect(tables).toEqual([[1, 2, 3, 4], [5, 6, 7]])
  })

  it('preserves player order within each table', () => {
    const tables = buildRoundOneTables([9, 8, 7, 6, 5, 4, 3])
    expect(tables).toEqual([[9, 8, 7, 6], [5, 4, 3]])
  })
})

describe('buildPairingRows', () => {
  it('maps a full 4-player table with pairing_is_full true', () => {
    const rows = buildPairingRows(1, 2, [[10, 20, 30, 40]])
    expect(rows).toEqual([{
      event_id: 1,
      pairing_round: 2,
      pairing_is_full: true,
      pairing_player1_id: 10,
      pairing_player2_id: 20,
      pairing_player3_id: 30,
      pairing_player4_id: 40,
    }])
  })

  it('maps a 3-player table with a null 4th seat and pairing_is_full false', () => {
    const rows = buildPairingRows(1, 2, [[10, 20, 30]])
    expect(rows[0]).toMatchObject({
      pairing_is_full: false,
      pairing_player4_id: null,
    })
  })

  it('drops tables with fewer than 3 players', () => {
    const rows = buildPairingRows(1, 1, [[10, 20], [10, 20, 30]])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.pairing_player1_id).toBe(10)
  })
})

describe('calculateRoundScores', () => {
  it('awards the ranked position value to each player with no ties', () => {
    const ruleset = makeRuleset()
    const pairing = makePairing()
    const results = [1, 2, 3, 4].map(playerId => makeResult({ pairing_id: 1, player_id: playerId, position: playerId }))
    const standingsMap = makeStandingsMap([1, 2, 3, 4])

    calculateRoundScores([pairing], results, standingsMap, [0, 4, 3, 2, 1], ruleset)

    expect(standingsMap.get(1)?.standing_player_score).toBe(4)
    expect(standingsMap.get(1)?.victories).toBe(1)
    expect(standingsMap.get(2)?.standing_player_score).toBe(3)
    expect(standingsMap.get(3)?.standing_player_score).toBe(2)
    expect(standingsMap.get(4)?.standing_player_score).toBe(1)
  })

  it('splits tied positions by averaging the ranks they occupy', () => {
    const ruleset = makeRuleset()
    const pairing = makePairing()
    // Two players tied for 2nd place split rank2 (3) + rank3 (2) => floor(5/2) = 2 each.
    const results = [
      makeResult({ pairing_id: 1, player_id: 1, position: 1 }),
      makeResult({ pairing_id: 1, player_id: 2, position: 2 }),
      makeResult({ pairing_id: 1, player_id: 3, position: 2 }),
      makeResult({ pairing_id: 1, player_id: 4, position: 4 }),
    ]
    const standingsMap = makeStandingsMap([1, 2, 3, 4])

    calculateRoundScores([pairing], results, standingsMap, [0, 4, 3, 2, 1], ruleset)

    expect(standingsMap.get(2)?.standing_player_score).toBe(2)
    expect(standingsMap.get(3)?.standing_player_score).toBe(2)
    expect(standingsMap.get(2)?.victories).toBe(0)
  })

  it('adds kill, brew-vote, and play-vote weights on top of the position score', () => {
    const ruleset = makeRuleset({ rule_set_kill: 2, rule_set_brew: 1, rule_set_play: 1 })
    const pairing = makePairing({ pairing_player3_id: null, pairing_player4_id: null })
    const results = [
      makeResult({ pairing_id: 1, player_id: 1, position: 1, number_of_kills: 3 }),
      // Player 2 votes brew + both plays for player 1.
      makeResult({ pairing_id: 1, player_id: 2, position: 2, brew_vote: 1, play_vote_1: 1, play_vote_2: 1 }),
    ]
    const standingsMap = makeStandingsMap([1, 2])

    calculateRoundScores([pairing], results, standingsMap, [0, 4, 3, 2, 1], ruleset)

    // rank(4) + kills(3*2=6) + brewVote(1*1=1) + playVote(1*1=1) = 12
    expect(standingsMap.get(1)?.standing_player_score).toBe(12)
    expect(standingsMap.get(1)?.brew_received).toBe(1)
    expect(standingsMap.get(1)?.play_received).toBe(1)
  })

  it('skips a seated player with no submitted result', () => {
    const ruleset = makeRuleset()
    const pairing = makePairing({ pairing_player3_id: null, pairing_player4_id: null })
    const results = [makeResult({ pairing_id: 1, player_id: 1, position: 1 })]
    const standingsMap = makeStandingsMap([1, 2])

    calculateRoundScores([pairing], results, standingsMap, [0, 4, 3, 2, 1], ruleset)

    expect(standingsMap.get(1)?.standing_player_score).toBe(4)
    expect(standingsMap.get(2)?.standing_player_score).toBe(0)
  })
})
