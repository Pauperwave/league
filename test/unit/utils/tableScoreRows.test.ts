// test\unit\utils\tableScoreRows.test.ts
import { describe, expect, it } from 'vitest'
import { buildTableScoreRows } from '~/utils/tableScoreRows'
import type { PairingWithResults, RoundResult, Ruleset, TournamentPlayer } from '#shared/utils/types'

function makeRuleset(overrides: Partial<Ruleset> = {}): Ruleset {
  return {
    ruleset_id: 1,
    name: 'Test Ruleset',
    rule_set_rank1: 8,
    rule_set_rank2: 6,
    rule_set_rank3: 4,
    rule_set_rank4: 2,
    rule_set_kill: 1,
    rule_set_brew: 1,
    rule_set_play: 1,
    rule_set_partecipation: 0,
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

function makePairing(overrides: Partial<PairingWithResults> = {}): PairingWithResults {
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
    round_results: [],
    ...overrides,
  }
}

function makePlayer(id: number, name = `P${id}`, surname = 'Test'): TournamentPlayer {
  return { id, name, surname }
}

const allPlayers = [1, 2, 3, 4].map(id => makePlayer(id))

describe('buildTableScoreRows', () => {
  it('returns an empty array for a null pairing', () => {
    expect(buildTableScoreRows(null, allPlayers, makeRuleset())).toEqual([])
  })

  it('scores every seated player using the ruleset\'s real rank values, fully specified', () => {
    const ruleset = makeRuleset()
    const pairing = makePairing({
      round_results: [
        // Every player has cast a vote (brew_vote/play_vote_1 set to some
        // target) so no row's deck/play points depend on a missing "other".
        makeResult({ player_id: 1, position: 1, number_of_kills: 2, brew_vote: 2, play_vote_1: 2 }),
        makeResult({ player_id: 2, position: 2, brew_vote: 1, play_vote_1: 1 }),
        makeResult({ player_id: 3, position: 3, brew_vote: 1, play_vote_1: 1 }),
        makeResult({ player_id: 4, position: 4, brew_vote: 1, play_vote_1: 1 }),
      ],
    })

    const rows = buildTableScoreRows(pairing, allPlayers, ruleset)

    expect(rows).toHaveLength(4)
    const player1 = rows.find(r => r.playerId === 1)!
    expect(player1.placementPoints).toBe(8)
    expect(player1.killPoints).toBe(2)
    expect(player1.deckPoints).toBe(3) // 3 other players voted brew for player 1
    expect(player1.total).toBe(8 + 2 + 3 + 3)
    // Every player has a submitted position/kills, and every OTHER player
    // has cast votes (brew_vote/play_vote_1 set) — nothing unspecified.
    for (const row of rows) {
      expect(row.placementUnspecified).toBe(false)
      expect(row.killUnspecified).toBe(false)
      expect(row.deckUnspecified).toBe(false)
      expect(row.playUnspecified).toBe(false)
    }
  })

  it('flags placement as unspecified when this player\'s own position is null', () => {
    const pairing = makePairing({
      round_results: [makeResult({ player_id: 1, position: null })],
    })
    const row = buildTableScoreRows(pairing, allPlayers, makeRuleset()).find(r => r.playerId === 1)!
    expect(row.placementUnspecified).toBe(true)
    expect(row.placementPoints).toBe(0)
  })

  it('flags kills as unspecified when this player\'s own number_of_kills is null, not when it is a real 0', () => {
    const pairing = makePairing({
      round_results: [
        makeResult({ player_id: 1, position: 1, number_of_kills: null }),
        makeResult({ player_id: 2, position: 2, number_of_kills: 0 }),
      ],
    })
    const rows = buildTableScoreRows(pairing, allPlayers, makeRuleset())
    expect(rows.find(r => r.playerId === 1)!.killUnspecified).toBe(true)
    expect(rows.find(r => r.playerId === 2)!.killUnspecified).toBe(false)
  })

  it('flags deck/play as unspecified when even one OTHER seated player has not voted yet', () => {
    const pairing = makePairing({
      round_results: [
        makeResult({ player_id: 1, position: 1 }),
        makeResult({ player_id: 2, position: 2, brew_vote: 1, play_vote_1: 1 }),
        makeResult({ player_id: 3, position: 3, brew_vote: 1, play_vote_1: 1 }),
        // Player 4 hasn't submitted votes yet (both null).
        makeResult({ player_id: 4, position: 4 }),
      ],
    })
    const row = buildTableScoreRows(pairing, allPlayers, makeRuleset()).find(r => r.playerId === 1)!
    expect(row.deckUnspecified).toBe(true)
    expect(row.playUnspecified).toBe(true)
  })

  it('does not require this player\'s own vote for their own deck/play to be "specified"', () => {
    // Player 1 hasn't voted (irrelevant to points they *receive*); every
    // OTHER player has, so player 1's own received points ARE fully known.
    const pairing = makePairing({
      round_results: [
        makeResult({ player_id: 1, position: 1 }),
        makeResult({ player_id: 2, position: 2, brew_vote: 1, play_vote_1: 1 }),
        makeResult({ player_id: 3, position: 3, brew_vote: 1, play_vote_1: 1 }),
        makeResult({ player_id: 4, position: 4, brew_vote: 1, play_vote_1: 1 }),
      ],
    })
    const row = buildTableScoreRows(pairing, allPlayers, makeRuleset()).find(r => r.playerId === 1)!
    expect(row.deckUnspecified).toBe(false)
    expect(row.playUnspecified).toBe(false)
  })

  it('handles a 3-player table (null 4th seat) without crashing', () => {
    const pairing = makePairing({
      pairing_player4_id: null,
      round_results: [
        makeResult({ player_id: 1, position: 1 }),
        makeResult({ player_id: 2, position: 2 }),
        makeResult({ player_id: 3, position: 3 }),
      ],
    })
    const rows = buildTableScoreRows(pairing, allPlayers, makeRuleset())
    expect(rows).toHaveLength(3)
  })

  it('sorts rows by total descending', () => {
    const pairing = makePairing({
      round_results: [
        makeResult({ player_id: 1, position: 4, number_of_kills: 0 }),
        makeResult({ player_id: 2, position: 1, number_of_kills: 0 }),
        makeResult({ player_id: 3, position: 3, number_of_kills: 0 }),
        makeResult({ player_id: 4, position: 2, number_of_kills: 0 }),
      ],
    })
    const rows = buildTableScoreRows(pairing, allPlayers, makeRuleset())
    expect(rows.map(r => r.playerId)).toEqual([2, 4, 3, 1])
  })

  it('breaks a total tie using placement (higher placementPoints first), not seat order', () => {
    const pairing = makePairing({
      round_results: [
        makeResult({ player_id: 1, position: 1, number_of_kills: 0 }),
        makeResult({ player_id: 2, position: 3, number_of_kills: 3 }), // placement 4 + 3 kills = 7
        makeResult({ player_id: 3, position: 2, number_of_kills: 1 }), // placement 6 + 1 kill = 7
        makeResult({ player_id: 4, position: 4, number_of_kills: 0 }),
      ],
    })
    const rows = buildTableScoreRows(pairing, allPlayers, makeRuleset())
    const tied = rows.filter(r => r.playerId === 2 || r.playerId === 3)
    expect(tied.map(r => r.total)).toEqual([7, 7])
    expect(tied.map(r => r.playerId)).toEqual([3, 2])
  })

  it('skips a seated player id that has no matching TournamentPlayer', () => {
    const pairing = makePairing()
    const rows = buildTableScoreRows(pairing, allPlayers.filter(p => p.id !== 2), makeRuleset())
    expect(rows.map(r => r.playerId)).toEqual([1, 3, 4])
  })
})
