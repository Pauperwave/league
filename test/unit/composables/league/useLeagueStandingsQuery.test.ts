// test\unit\composables\league\useLeagueStandingsQuery.test.ts
import { describe, expect, it } from 'vitest'
import {
  aggregateKillsByPlayer,
  aggregateLeagueStandings,
  type LeagueStandingRow,
} from '~/composables/league/useLeagueStandingsQuery'

describe('aggregateKillsByPlayer', () => {
  it('sums number_of_kills across multiple round_results rows for the same player', () => {
    const killsMap = aggregateKillsByPlayer([
      { player_id: 1, number_of_kills: 2 },
      { player_id: 1, number_of_kills: 1 },
      { player_id: 2, number_of_kills: 3 },
    ])

    expect(killsMap.get(1)).toBe(3)
    expect(killsMap.get(2)).toBe(3)
  })

  it('treats a null number_of_kills as 0 instead of poisoning the sum', () => {
    const killsMap = aggregateKillsByPlayer([
      { player_id: 1, number_of_kills: 2 },
      { player_id: 1, number_of_kills: null },
    ])

    expect(killsMap.get(1)).toBe(2)
  })

  it('returns an empty map for no results', () => {
    expect(aggregateKillsByPlayer([]).size).toBe(0)
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

    const [result] = aggregateLeagueStandings(rows, new Map(), new Map())

    expect(result).toMatchObject({
      standing_player_score: 15,
      victories: 1,
      brew_received: 3,
      play_received: 1,
    })
  })

  it('merges in the recomputed kill count for each player (regression: kills used to be silently dropped)', () => {
    const rows = [makeRow({ player_id: 1, standing_player_score: 10 })]
    const killsMap = new Map([[1, 4]])

    const [result] = aggregateLeagueStandings(rows, killsMap, new Map())

    expect(result?.kills).toBe(4)
  })

  it('defaults a player with no kills entry to 0, not undefined', () => {
    const rows = [makeRow({ player_id: 1 })]

    const [result] = aggregateLeagueStandings(rows, new Map(), new Map())

    expect(result?.kills).toBe(0)
  })

  it('does not accumulate kills a second time when a player has multiple standings rows', () => {
    // aggregateLeagueStandings only looks up the kills map once, on first
    // sight of a player_id — the map itself is already summed across every
    // tournament by aggregateKillsByPlayer, so re-adding it per row would
    // double (or triple) count.
    const rows = [
      makeRow({ player_id: 1, standing_player_score: 10 }),
      makeRow({ player_id: 1, standing_player_score: 5 }),
    ]
    const killsMap = new Map([[1, 4]])

    const [result] = aggregateLeagueStandings(rows, killsMap, new Map())

    expect(result?.kills).toBe(4)
  })

  it('merges in the recomputed placement points for each player (regression: always showed 0 on the league page)', () => {
    const rows = [makeRow({ player_id: 1, standing_player_score: 10 })]
    const placementPointsMap = new Map([[1, 7]])

    const [result] = aggregateLeagueStandings(rows, new Map(), placementPointsMap)

    expect(result?.placementPoints).toBe(7)
  })

  it('defaults a player with no placement points entry to 0, not undefined', () => {
    const rows = [makeRow({ player_id: 1 })]

    const [result] = aggregateLeagueStandings(rows, new Map(), new Map())

    expect(result?.placementPoints).toBe(0)
  })

  it('defaults null numeric fields to 0', () => {
    const [result] = aggregateLeagueStandings([makeRow({ player_id: 1 })], new Map(), new Map())

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

    const result = aggregateLeagueStandings(rows, new Map(), new Map())

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

    const [result] = aggregateLeagueStandings(rows, new Map(), new Map())

    expect(result?.players).toMatchObject({ player_id: 1, player_name: 'Ada', player_surname: 'Lovelace' })
  })

  it('leaves players undefined when the row has no joined player', () => {
    const [result] = aggregateLeagueStandings([makeRow({ player_id: 1, players: null })], new Map(), new Map())

    expect(result?.players).toBeUndefined()
  })
})
