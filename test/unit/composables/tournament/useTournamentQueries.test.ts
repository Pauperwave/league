// test\unit\composables\tournament\useTournamentQueries.test.ts
import { describe, expect, it } from 'vitest'
import { mergeEventStandings, type EventStandingRow } from '~/composables/tournament/useTournamentQueries'
import type { PlayerPointBreakdown } from '#shared/utils/roundScoring'

function makeRow(overrides: Partial<EventStandingRow> & { player_id: number }): EventStandingRow {
  return {
    standing_id: overrides.player_id,
    tournament_id: 1,
    standing_player_score: null,
    standing_player_rank: null,
    victories: null,
    brew_received: null,
    play_received: null,
    players: null,
    ...overrides,
  }
}

function makeBreakdown(overrides: Partial<PlayerPointBreakdown> = {}): PlayerPointBreakdown {
  return { kills: 0, placementPoints: 0, killPoints: 0, brewPoints: 0, playPoints: 0, ...overrides }
}

describe('mergeEventStandings', () => {
  it('breaks a tied score by the shared tie-break instead of arbitrary DB row order (regression: 2026-07-31 fix)', () => {
    // Same shape as tournament 284's real 3-way tie: Dalmaso (fewer brew
    // votes) was rendered above Zancanella (more) before this was fixed —
    // rows arrive in a DB-arbitrary order that happens to be "wrong" here.
    const rows = [
      makeRow({ player_id: 9, standing_player_score: 25, victories: 1, brew_received: 2 }), // Dalmaso
      makeRow({ player_id: 19, standing_player_score: 25, victories: 1, brew_received: 5 }), // Zancanella
      makeRow({ player_id: 120, standing_player_score: 25, victories: 2, brew_received: 2 }), // Berti
    ]

    const result = mergeEventStandings(rows, new Map())

    expect(result.map(r => r.player_id)).toEqual([120, 19, 9])
  })

  it('merges the recomputed point breakdown onto the matching row', () => {
    const rows = [makeRow({ player_id: 1, standing_player_score: 10 })]
    const breakdowns = new Map([[1, makeBreakdown({ kills: 3, placementPoints: 8, killPoints: 3, brewPoints: 2, playPoints: 1 })]])

    const [result] = mergeEventStandings(rows, breakdowns)

    expect(result).toMatchObject({ kills: 3, placementPoints: 8, killPoints: 3, brewPoints: 2, playPoints: 1 })
  })

  it('defaults a player with no breakdown entry to 0 across every point field', () => {
    const [result] = mergeEventStandings([makeRow({ player_id: 1 })], new Map())

    expect(result).toMatchObject({ kills: 0, placementPoints: 0, killPoints: 0, brewPoints: 0, playPoints: 0 })
  })

  it('preserves the real persisted standing_id/tournament_id/standing_player_rank (single-tournament rows, not synthesized like the league-wide aggregation)', () => {
    const rows = [makeRow({ player_id: 1, standing_id: 42, tournament_id: 284, standing_player_rank: 7 })]

    const [result] = mergeEventStandings(rows, new Map())

    expect(result).toMatchObject({ standing_id: 42, tournament_id: 284, standing_player_rank: 7 })
  })

  it('sanitizes the nested player payload when present', () => {
    const rows = [makeRow({ player_id: 1, players: { player_id: 1, player_name: 'Ada', player_surname: 'Lovelace' } })]

    const [result] = mergeEventStandings(rows, new Map())

    expect(result?.players).toMatchObject({ player_id: 1, player_name: 'Ada', player_surname: 'Lovelace' })
  })

  it('leaves players undefined when the row has no joined player', () => {
    const [result] = mergeEventStandings([makeRow({ player_id: 1, players: null })], new Map())

    expect(result?.players).toBeUndefined()
  })
})
