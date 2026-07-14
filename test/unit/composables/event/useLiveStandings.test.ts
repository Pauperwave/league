// test\unit\composables\event\useLiveStandings.test.ts
import { describe, expect, it } from 'vitest'
import { buildPosValues, cloneStandings, calculatePlayerTableScore, updateStanding } from '~/composables/event/useLiveStandings'
import type { StandingWithPlayer } from '#shared/utils/types'

const ruleset = {
  rule_set_rank1: 10,
  rule_set_rank2: 7,
  rule_set_rank3: 4,
  rule_set_rank4: 1,
  rule_set_kill: 2,
  rule_set_brew: 1,
  rule_set_play: 1,
}

function makeStanding(playerId: number): StandingWithPlayer {
  return {
    standing_id: playerId,
    event_id: 1,
    player_id: playerId,
    standing_player_score: null,
    victories: null,
    brew_received: null,
    play_received: null,
    standing_player_rank: null,
  }
}

describe('buildPosValues', () => {
  it('builds a 0-indexed lookup with position 0 as a dummy slot', () => {
    expect(buildPosValues(ruleset)).toEqual([0, 10, 7, 4, 1])
  })

  it('defaults missing rank values to 0', () => {
    const sparse = { ...ruleset, rule_set_rank3: undefined as unknown as number }
    expect(buildPosValues(sparse)).toEqual([0, 10, 7, 0, 1])
  })
})

describe('cloneStandings', () => {
  it('defaults null numeric fields to 0', () => {
    const [cloned] = cloneStandings([makeStanding(1)])
    expect(cloned).toMatchObject({
      standing_player_score: 0,
      victories: 0,
      kills: 0,
      brew_received: 0,
      play_received: 0,
    })
  })

  it('preserves existing non-null values', () => {
    const standing = { ...makeStanding(1), standing_player_score: 15, victories: 2 }
    const [cloned] = cloneStandings([standing])
    expect(cloned?.standing_player_score).toBe(15)
    expect(cloned?.victories).toBe(2)
  })
})

describe('calculatePlayerTableScore', () => {
  const noVotes = () => null

  it('scores rank position using the posValues lookup', () => {
    const posValues = buildPosValues(ruleset)
    const ranking = [{ playerId: 1, rank: 1 }, { playerId: 2, rank: 2 }]

    const score = calculatePlayerTableScore(1, [1, 2], posValues, ranking, [], ruleset, noVotes, noVotes)

    expect(score.position).toBe(1)
    expect(score.totalScore).toBe(10)
  })

  it('splits points evenly across tied ranks', () => {
    const posValues = buildPosValues(ruleset)
    // Two players tied for rank 1: (10 + 7) / 2 = 8 each (floored)
    const ranking = [{ playerId: 1, rank: 1 }, { playerId: 2, rank: 1 }]

    const score = calculatePlayerTableScore(1, [1, 2], posValues, ranking, [], ruleset, noVotes, noVotes)

    expect(score.totalScore).toBe(8)
  })

  it('adds kill points from tableKills', () => {
    const posValues = buildPosValues(ruleset)
    const tableKills = [{ killerId: 1, victimId: 2 }, { killerId: 1, victimId: 3 }]

    const score = calculatePlayerTableScore(1, [1, 2, 3], posValues, null, tableKills, ruleset, noVotes, noVotes)

    expect(score.numberOfKills).toBe(2)
    expect(score.totalScore).toBe(2 * ruleset.rule_set_kill)
  })

  it('adds brew and play vote points from other players only', () => {
    const posValues = buildPosValues(ruleset)
    const getDeckVote = (id: number) => (id === 2 ? 1 : null)
    const getPlayVote = (id: number) => (id === 3 ? 1 : null)

    const score = calculatePlayerTableScore(1, [1, 2, 3], posValues, null, [], ruleset, getDeckVote, getPlayVote)

    expect(score.brewVote).toBe(1)
    expect(score.totalPlayCount).toBe(1)
    expect(score.totalScore).toBe(ruleset.rule_set_brew + ruleset.rule_set_play)
  })

  it('scores zero when there is no ranking, kills, or votes', () => {
    const posValues = buildPosValues(ruleset)
    const score = calculatePlayerTableScore(1, [1, 2], posValues, null, [], ruleset, noVotes, noVotes)
    expect(score.totalScore).toBe(0)
  })
})

describe('updateStanding', () => {
  it('accumulates score fields onto the matching standing', () => {
    const [standing] = cloneStandings([makeStanding(1)])
    const result = standing ? [standing] : []

    updateStanding(result, 1, { totalScore: 10, position: 1, numberOfKills: 2, brewVote: 1, totalPlayCount: 1 })

    expect(result[0]).toMatchObject({
      standing_player_score: 10,
      victories: 1,
      kills: 2,
      brew_received: 1,
      play_received: 1,
    })
  })

  it('only counts a victory when position is exactly 1', () => {
    const [standing] = cloneStandings([makeStanding(1)])
    const result = standing ? [standing] : []

    updateStanding(result, 1, { totalScore: 5, position: 2, numberOfKills: 0, brewVote: 0, totalPlayCount: 0 })

    expect(result[0]?.victories).toBe(0)
  })

  it('is a no-op when the player has no matching standing', () => {
    const result = cloneStandings([makeStanding(1)])
    updateStanding(result, 999, { totalScore: 10, position: 1, numberOfKills: 0, brewVote: 0, totalPlayCount: 0 })
    expect(result[0]?.standing_player_score).toBe(0)
  })
})
