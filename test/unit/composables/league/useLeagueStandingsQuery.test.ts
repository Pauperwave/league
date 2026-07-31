// test\unit\composables\league\useLeagueStandingsQuery.test.ts
import { describe, expect, it } from 'vitest'
import {
  aggregateLeagueStandings,
  sumPointBreakdowns,
  type LeagueStandingRow,
} from '~/composables/league/useLeagueStandingsQuery'
import type { PlayerPointBreakdown } from '#shared/utils/roundScoring'

function makeBreakdown(overrides: Partial<PlayerPointBreakdown> = {}): PlayerPointBreakdown {
  return { kills: 0, placementPoints: 0, killPoints: 0, brewPoints: 0, playPoints: 0, ...overrides }
}

describe('sumPointBreakdowns', () => {
  it('sums each field across multiple tournaments for the same player', () => {
    const summed = sumPointBreakdowns([
      new Map([[1, makeBreakdown({ kills: 2, placementPoints: 4, killPoints: 4, brewPoints: 1, playPoints: 1 })]]),
      new Map([[1, makeBreakdown({ kills: 1, placementPoints: 3, killPoints: 0, brewPoints: 2, playPoints: 0 })]]),
    ])

    expect(summed.get(1)).toEqual({ kills: 3, placementPoints: 7, killPoints: 4, brewPoints: 3, playPoints: 1 })
  })

  it('keeps players independent across tournaments', () => {
    const summed = sumPointBreakdowns([
      new Map([[1, makeBreakdown({ kills: 2 })]]),
      new Map([[2, makeBreakdown({ kills: 5 })]]),
    ])

    expect(summed.get(1)?.kills).toBe(2)
    expect(summed.get(2)?.kills).toBe(5)
  })

  it('returns an empty map for no tournaments', () => {
    expect(sumPointBreakdowns([]).size).toBe(0)
  })
})

function makeRow(overrides: Partial<LeagueStandingRow> & { player_id: number }): LeagueStandingRow {
  return {
    standing_player_score: null,
    victories: null,
    brew_received: null,
    play_received: null,
    players: null,
    ...overrides,
  }
}

describe('aggregateLeagueStandings', () => {
  it('sums score/victories/brew/play across a player\'s standings rows from multiple tournaments', () => {
    const rows = [
      makeRow({ player_id: 1, standing_player_score: 10, victories: 1, brew_received: 1, play_received: 0 }),
      makeRow({ player_id: 1, standing_player_score: 5, victories: 0, brew_received: 2, play_received: 1 }),
    ]

    const [result] = aggregateLeagueStandings(rows, new Map())

    expect(result).toMatchObject({
      standing_player_score: 15,
      victories: 1,
      brew_received: 3,
      play_received: 1,
    })
  })

  it('merges in the recomputed point breakdown for each player (regression: kills/placementPoints used to be silently dropped)', () => {
    const rows = [makeRow({ player_id: 1, standing_player_score: 10 })]
    const breakdowns = new Map([[1, makeBreakdown({ kills: 4, placementPoints: 7, killPoints: 4, brewPoints: 2, playPoints: 1 })]])

    const [result] = aggregateLeagueStandings(rows, breakdowns)

    expect(result).toMatchObject({ kills: 4, placementPoints: 7, killPoints: 4, brewPoints: 2, playPoints: 1 })
  })

  it('defaults a player with no breakdown entry to 0 across every point field, not undefined', () => {
    const rows = [makeRow({ player_id: 1 })]

    const [result] = aggregateLeagueStandings(rows, new Map())

    expect(result).toMatchObject({ kills: 0, placementPoints: 0, killPoints: 0, brewPoints: 0, playPoints: 0 })
  })

  it('does not accumulate the breakdown a second time when a player has multiple standings rows', () => {
    // aggregateLeagueStandings only looks up the breakdown map once, on
    // first sight of a player_id — the map itself is already summed across
    // every tournament by sumPointBreakdowns, so re-adding it per row would
    // double (or triple) count.
    const rows = [
      makeRow({ player_id: 1, standing_player_score: 10 }),
      makeRow({ player_id: 1, standing_player_score: 5 }),
    ]
    const breakdowns = new Map([[1, makeBreakdown({ kills: 4 })]])

    const [result] = aggregateLeagueStandings(rows, breakdowns)

    expect(result?.kills).toBe(4)
  })

  it('defaults null numeric fields to 0', () => {
    const [result] = aggregateLeagueStandings([makeRow({ player_id: 1 })], new Map())

    expect(result).toMatchObject({
      standing_player_score: 0,
      victories: 0,
      brew_received: 0,
      play_received: 0,
    })
  })

  it('sorts by the shared standings tie-break (score, then victories, then player_id)', () => {
    const rows = [
      makeRow({ player_id: 2, standing_player_score: 10, victories: 0 }),
      makeRow({ player_id: 3, standing_player_score: 10, victories: 1 }),
      makeRow({ player_id: 1, standing_player_score: 20, victories: 0 }),
    ]

    const result = aggregateLeagueStandings(rows, new Map())

    expect(result.map(r => r.player_id)).toEqual([1, 3, 2])
  })

  it('sanitizes the nested player payload when present', () => {
    const rows = [
      makeRow({
        player_id: 1,
        players: {
          player_id: 1,
          player_name: 'Ada',
          player_surname: 'Lovelace',
          formats_played: null,
          is_active: true,
        },
      }),
    ]

    const [result] = aggregateLeagueStandings(rows, new Map())

    expect(result?.players).toMatchObject({ player_id: 1, player_name: 'Ada', player_surname: 'Lovelace' })
  })

  it('leaves players undefined when the row has no joined player', () => {
    const [result] = aggregateLeagueStandings([makeRow({ player_id: 1, players: null })], new Map())

    expect(result?.players).toBeUndefined()
  })
})
