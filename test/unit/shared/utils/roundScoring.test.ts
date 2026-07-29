// test\unit\shared\utils\roundScoring.test.ts
import { describe, expect, it } from 'vitest'
import { buildPairingRows, buildRoundOneTables, calculatePlayerTableScore, calculateRoundScores } from '#shared/utils/roundScoring'
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
    ...overrides,
  }
}

function makePairing(overrides: Partial<Pairing> = {}): Pairing {
  return {
    tournament_id: 1,
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
      tournament_id: 1,
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

describe('calculatePlayerTableScore', () => {
  it('returns null when the player has no submitted result', () => {
    const results = [makeResult({ pairing_id: 1, player_id: 1, position: 1 })]
    expect(calculatePlayerTableScore(2, results, [0, 4, 3, 2, 1], makeRuleset())).toBeNull()
  })

  it('weights kills, brew votes, and play votes by the ruleset — not raw counts', () => {
    const ruleset = makeRuleset({ rule_set_kill: 2, rule_set_brew: 5, rule_set_play: 3 })
    const results = [
      makeResult({ pairing_id: 1, player_id: 1, position: 1, number_of_kills: 3 }),
      makeResult({ pairing_id: 1, player_id: 2, position: 2, brew_vote: 1, play_vote_1: 1, play_vote_2: 1 }),
    ]

    const scored = calculatePlayerTableScore(1, results, [0, 4, 3, 2, 1], ruleset)

    expect(scored).toMatchObject({
      playerId: 1,
      position: 1,
      scoreRank: 4,
      numberOfKills: 3,
      killScore: 6, // 3 kills * 2
      brewVote: 1,
      brewScore: 5, // 1 vote * 5
      totalPlayCount: 1,
      playScore: 3, // 1 vote * 3
      totalScore: 18, // 4 + 6 + 5 + 3
    })
  })

  it('uses the ruleset\'s actual rank values, matching a real 8/6/4/2 configuration', () => {
    const ruleset = makeRuleset({ rule_set_rank1: 8, rule_set_rank2: 6, rule_set_rank3: 4, rule_set_rank4: 2 })
    const results = [1, 2, 3, 4].map(playerId => makeResult({ pairing_id: 1, player_id: playerId, position: playerId }))
    const posValues = [0, 8, 6, 4, 2]

    expect(calculatePlayerTableScore(1, results, posValues, ruleset)?.scoreRank).toBe(8)
    expect(calculatePlayerTableScore(2, results, posValues, ruleset)?.scoreRank).toBe(6)
    expect(calculatePlayerTableScore(3, results, posValues, ruleset)?.scoreRank).toBe(4)
    expect(calculatePlayerTableScore(4, results, posValues, ruleset)?.scoreRank).toBe(2)
  })

  it('only counts votes cast by other players, never a self-vote', () => {
    const ruleset = makeRuleset()
    const results = [
      makeResult({ pairing_id: 1, player_id: 1, position: 1, brew_vote: 1, play_vote_1: 1 }),
      makeResult({ pairing_id: 1, player_id: 2, position: 2, brew_vote: 1, play_vote_1: 1 }),
    ]

    const scored = calculatePlayerTableScore(1, results, [0, 4, 3, 2, 1], ruleset)

    expect(scored?.brewVote).toBe(1)
    expect(scored?.totalPlayCount).toBe(1)
  })

  it('treats a null position (not yet ranked) as unscored — 0, not a crash or NaN', () => {
    const results = [makeResult({ pairing_id: 1, player_id: 1, position: null })]
    const scored = calculatePlayerTableScore(1, results, [0, 4, 3, 2, 1], makeRuleset())
    expect(scored?.position).toBe(0)
    expect(scored?.scoreRank).toBe(0)
  })

  it('treats a null number_of_kills as 0 kills, not NaN', () => {
    const results = [makeResult({ pairing_id: 1, player_id: 1, position: 1, number_of_kills: null })]
    const scored = calculatePlayerTableScore(1, results, [0, 4, 3, 2, 1], makeRuleset())
    expect(scored?.numberOfKills).toBe(0)
    expect(scored?.killScore).toBe(0)
  })

  it('scores rank from posValues even with a null ruleset — only kill/brew/play weights need it', () => {
    const results = [
      makeResult({ pairing_id: 1, player_id: 1, position: 1, number_of_kills: 5 }),
      // Player 2 votes brew for player 1.
      makeResult({ pairing_id: 1, player_id: 2, position: 2, brew_vote: 1, play_vote_1: 1 }),
    ]
    const scored = calculatePlayerTableScore(1, results, [0, 4, 3, 2, 1], null)
    expect(scored?.scoreRank).toBe(4)
    expect(scored?.killScore).toBe(0)
    expect(scored?.brewVote).toBe(1)
    expect(scored?.brewScore).toBe(0)
    expect(scored?.totalScore).toBe(4)
  })

  it('a 4-way tie for 1st averages and clamps against the shortest posValues array', () => {
    // Every rank slot (1st..4th) gets consumed by the tie; effectivePosition
    // + i walks past the array's last real index (4) for i=3 — Math.min(...,
    // 4) must clamp instead of reading undefined/NaN off the end.
    const ruleset = makeRuleset()
    const results = [1, 2, 3, 4].map(playerId => makeResult({ pairing_id: 1, player_id: playerId, position: 1 }))
    const posValues = [0, 4, 3, 2, 1]

    // floor((4+3+2+1)/4) = 2, identical for all four tied players.
    for (const playerId of [1, 2, 3, 4]) {
      expect(calculatePlayerTableScore(playerId, results, posValues, ruleset)?.scoreRank).toBe(2)
    }
  })

  it('counts a single other-player row once even if both play votes target the same player', () => {
    const ruleset = makeRuleset()
    const results = [
      makeResult({ pairing_id: 1, player_id: 1, position: 1 }),
      // Player 2's two play-vote slots both point at player 1 — still one row.
      makeResult({ pairing_id: 1, player_id: 2, position: 2, play_vote_1: 1, play_vote_2: 1 }),
    ]

    expect(calculatePlayerTableScore(1, results, [0, 4, 3, 2, 1], ruleset)?.totalPlayCount).toBe(1)
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

  it('scores a 2-way tie for 1st with skip-rank spacing, not the raw dense position', () => {
    // TableScoreGrid/useRankingGrid only ever stores dense ranks (1,1,2,3 —
    // "ranks used must form a consecutive sequence"), never a skip-rank
    // 1,1,3,4. The two must score identically: after a 2-way tie for 1st,
    // the next player is effectively 3rd (two point-slots already consumed
    // by the tie), not 2nd.
    const ruleset = makeRuleset()
    const pairing = makePairing()
    const results = [
      makeResult({ pairing_id: 1, player_id: 1, position: 1 }),
      makeResult({ pairing_id: 1, player_id: 2, position: 1 }),
      makeResult({ pairing_id: 1, player_id: 3, position: 2 }),
      makeResult({ pairing_id: 1, player_id: 4, position: 3 }),
    ]
    const standingsMap = makeStandingsMap([1, 2, 3, 4])

    calculateRoundScores([pairing], results, standingsMap, [0, 4, 3, 2, 1], ruleset)

    // Tied for 1st: floor((rank1=4 + rank2=3) / 2) = 3 each.
    expect(standingsMap.get(1)?.standing_player_score).toBe(3)
    expect(standingsMap.get(2)?.standing_player_score).toBe(3)
    // Effectively 3rd (not 2nd): rank3 = 2.
    expect(standingsMap.get(3)?.standing_player_score).toBe(2)
    // Effectively 4th (not 3rd): rank4 = 1.
    expect(standingsMap.get(4)?.standing_player_score).toBe(1)
  })

  it('scores a 3-way tie for 1st with skip-rank spacing', () => {
    const ruleset = makeRuleset()
    const pairing = makePairing()
    const results = [
      makeResult({ pairing_id: 1, player_id: 1, position: 1 }),
      makeResult({ pairing_id: 1, player_id: 2, position: 1 }),
      makeResult({ pairing_id: 1, player_id: 3, position: 1 }),
      makeResult({ pairing_id: 1, player_id: 4, position: 2 }),
    ]
    const standingsMap = makeStandingsMap([1, 2, 3, 4])

    calculateRoundScores([pairing], results, standingsMap, [0, 4, 3, 2, 1], ruleset)

    // Tied for 1st: floor((rank1=4 + rank2=3 + rank3=2) / 3) = 3 each.
    expect(standingsMap.get(1)?.standing_player_score).toBe(3)
    expect(standingsMap.get(2)?.standing_player_score).toBe(3)
    expect(standingsMap.get(3)?.standing_player_score).toBe(3)
    // Effectively 4th (not 2nd): rank4 = 1.
    expect(standingsMap.get(4)?.standing_player_score).toBe(1)
  })

  it('scores a 2-way tie for 2nd (after a clear 1st) with skip-rank spacing', () => {
    const ruleset = makeRuleset()
    const pairing = makePairing()
    const results = [
      makeResult({ pairing_id: 1, player_id: 1, position: 1 }),
      makeResult({ pairing_id: 1, player_id: 2, position: 2 }),
      makeResult({ pairing_id: 1, player_id: 3, position: 2 }),
      makeResult({ pairing_id: 1, player_id: 4, position: 3 }),
    ]
    const standingsMap = makeStandingsMap([1, 2, 3, 4])

    calculateRoundScores([pairing], results, standingsMap, [0, 4, 3, 2, 1], ruleset)

    expect(standingsMap.get(1)?.standing_player_score).toBe(4)
    // Tied for 2nd: floor((rank2=3 + rank3=2) / 2) = 2 each.
    expect(standingsMap.get(2)?.standing_player_score).toBe(2)
    expect(standingsMap.get(3)?.standing_player_score).toBe(2)
    // Effectively 4th (not 3rd): rank4 = 1.
    expect(standingsMap.get(4)?.standing_player_score).toBe(1)
  })

  it('credits no victories for a "Patta" (draw) — nobody was last standing', () => {
    // handleDrawSubmit's shape: zero kills for everyone, everyone tied for
    // 1st. Unlike a genuine multi-way tie for 1st, nobody actually won this
    // table (the winner is whoever's alive at round end, and a draw means
    // nobody was) — so, unlike the tie tests above, victories stay at 0.
    const ruleset = makeRuleset()
    const pairing = makePairing()
    const results = [1, 2, 3, 4].map(playerId => makeResult({ pairing_id: 1, player_id: playerId, position: 1, number_of_kills: 0 }))
    const standingsMap = makeStandingsMap([1, 2, 3, 4])

    calculateRoundScores([pairing], results, standingsMap, [0, 4, 3, 2, 1], ruleset)

    // Still scores as a 4-way tie: floor((4+3+2+1)/4) = 2 each.
    for (const playerId of [1, 2, 3, 4]) {
      expect(standingsMap.get(playerId)?.standing_player_score).toBe(2)
      expect(standingsMap.get(playerId)?.victories).toBe(0)
    }
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
