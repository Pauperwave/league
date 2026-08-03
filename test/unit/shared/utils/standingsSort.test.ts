// test\unit\shared\utils\standingsSort.test.ts
import { describe, expect, it } from 'vitest'
import { compareStandings } from '#shared/utils/standingsSort'
import type { StandingSortable } from '#shared/utils/standingsSort'

function makeStanding(overrides: Partial<StandingSortable> & { player_id: number }): StandingSortable {
  return {
    standing_player_score: null,
    victories: null,
    kills: null,
    brew_received: null,
    play_received: null,
    ...overrides,
  }
}

describe('compareStandings', () => {
  it('ranks a higher standing_player_score first', () => {
    const a = makeStanding({ player_id: 1, standing_player_score: 10 })
    const b = makeStanding({ player_id: 2, standing_player_score: 20 })

    expect([a, b].sort(compareStandings).map(s => s.player_id)).toEqual([2, 1])
  })

  it('breaks a score tie by victories', () => {
    const a = makeStanding({ player_id: 1, standing_player_score: 10, victories: 1 })
    const b = makeStanding({ player_id: 2, standing_player_score: 10, victories: 2 })

    expect([a, b].sort(compareStandings).map(s => s.player_id)).toEqual([2, 1])
  })

  it('breaks a score+victories tie by kills, before falling to the vote-based criteria (ADR-047)', () => {
    const a = makeStanding({ player_id: 1, standing_player_score: 25, victories: 1, kills: 2 })
    const b = makeStanding({ player_id: 2, standing_player_score: 25, victories: 1, kills: 5 })

    expect([a, b].sort(compareStandings).map(s => s.player_id)).toEqual([2, 1])
  })

  it('breaks a score+victories+kills tie by brew_received (regression: this is the tie-break the ended-tournament view was skipping)', () => {
    const a = makeStanding({ player_id: 1, standing_player_score: 25, victories: 1, kills: 2, brew_received: 2 })
    const b = makeStanding({ player_id: 2, standing_player_score: 25, victories: 1, kills: 2, brew_received: 5 })

    expect([a, b].sort(compareStandings).map(s => s.player_id)).toEqual([2, 1])
  })

  it('breaks a score+victories+kills+brew tie by play_received', () => {
    const a = makeStanding({
      player_id: 1,
      standing_player_score: 10,
      victories: 1,
      kills: 1,
      brew_received: 1,
      play_received: 1
    })
    const b = makeStanding({
      player_id: 2,
      standing_player_score: 10,
      victories: 1,
      kills: 1,
      brew_received: 1,
      play_received: 3
    })

    expect([a, b].sort(compareStandings).map(s => s.player_id)).toEqual([2, 1])
  })

  it('falls back to ascending player_id as the final, deterministic tie-break', () => {
    const a = makeStanding({ player_id: 5 })
    const b = makeStanding({ player_id: 2 })

    expect([a, b].sort(compareStandings).map(s => s.player_id)).toEqual([2, 5])
  })

  it('treats null numeric fields as 0 rather than crashing or sorting them last unpredictably', () => {
    const a = makeStanding({ player_id: 1, standing_player_score: null })
    const b = makeStanding({ player_id: 2, standing_player_score: 5 })

    expect([a, b].sort(compareStandings).map(s => s.player_id)).toEqual([2, 1])
  })

  it('is stable/idempotent — sorting an already-sorted list changes nothing', () => {
    const list = [
      makeStanding({ player_id: 1, standing_player_score: 20 }),
      makeStanding({ player_id: 2, standing_player_score: 10 }),
      makeStanding({ player_id: 3, standing_player_score: 5 }),
    ]

    expect(list.sort(compareStandings).map(s => s.player_id)).toEqual([1, 2, 3])
  })
})
