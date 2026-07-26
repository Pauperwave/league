// test\unit\composables\event\useTableCompletion.test.ts
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { useRankingsStore } from '~/stores/rankings'
import { useCommandersStore } from '~/stores/commanders'
import { useVotesStore } from '~/stores/votes'
import { useTableCompletion } from '~/composables/event/useTableCompletion'
import type { Pairing, PairingWithResults, RoundResult } from '#shared/utils/types'

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

function makeResult(overrides: Partial<RoundResult> = {}): RoundResult {
  return {
    id: 0,
    pairing_id: 1,
    player_id: 1,
    position: 1,
    number_of_kills: null,
    brew_vote: null,
    play_vote_1: null,
    play_vote_2: null,
    commander_1: null,
    commander_2: null,
    ...overrides,
  }
}

/** Mounts a throwaway component so the 3 session stores get a real, isolated Pinia instance. */
function setupCompletion() {
  let completion!: ReturnType<typeof useTableCompletion>
  let rankingsStore!: ReturnType<typeof useRankingsStore>
  let commandersStore!: ReturnType<typeof useCommandersStore>
  let votesStore!: ReturnType<typeof useVotesStore>

  mount(defineComponent({
    setup() {
      rankingsStore = useRankingsStore()
      commandersStore = useCommandersStore()
      votesStore = useVotesStore()
      completion = useTableCompletion(rankingsStore, commandersStore, votesStore)
      return () => h('div')
    },
  }), {
    global: { plugins: [createPinia()] },
  })

  return { ...completion, rankingsStore, commandersStore, votesStore }
}

describe('useTableCompletion', () => {
  it('hasRanking is false until every seated player has a ranking entry', () => {
    const { hasRanking, rankingsStore } = setupCompletion()
    const pairing = makePairing()

    expect(hasRanking(pairing)).toBe(false)

    // Only 2 of the 4 seated players ranked — not complete yet.
    rankingsStore.setRankingWithRanks(1, [{ playerId: 1, rank: 1 }, { playerId: 2, rank: 2 }])
    expect(hasRanking(pairing)).toBe(false)

    rankingsStore.setRankingWithRanks(1, [1, 2, 3, 4].map(playerId => ({ playerId, rank: playerId })))
    expect(hasRanking(pairing)).toBe(true)
  })

  it('hasKills is true once round_results has any non-null number_of_kills, independent of killsStore', () => {
    const { hasKills } = setupCompletion()

    const notYetConfirmed = makePairing({ round_results: [makeResult({ number_of_kills: null })] })
    expect(hasKills(notYetConfirmed)).toBe(false)

    const confirmedWithZeroKills = makePairing({ round_results: [makeResult({ number_of_kills: 0 })] })
    expect(hasKills(confirmedWithZeroKills)).toBe(true)
  })

  it('isDraw is true when every seated player has zero kills and ties for rank 1', () => {
    const { isDraw, rankingsStore } = setupCompletion()
    const pairing = makePairing({
      round_results: [1, 2, 3, 4].map(playerId => makeResult({ player_id: playerId, number_of_kills: 0 })),
    })

    expect(isDraw(pairing)).toBe(false)

    rankingsStore.setRankingWithRanks(1, [1, 2, 3, 4].map(playerId => ({ playerId, rank: 1 })))
    expect(isDraw(pairing)).toBe(true)
  })

  it('isTableComplete requires a ranking, every seated player to have a commander, and every seated player to have voted', () => {
    const { isTableComplete, rankingsStore, commandersStore, votesStore } = setupCompletion()
    const pairing: Pairing = makePairing()
    const playerIds = [1, 2, 3, 4]

    expect(isTableComplete(pairing)).toBe(false)

    rankingsStore.setRankingWithRanks(1, playerIds.map(playerId => ({ playerId, rank: playerId })))
    expect(isTableComplete(pairing)).toBe(false)

    for (const playerId of playerIds) commandersStore.setCommanders(playerId, 'Some Commander', null)
    expect(isTableComplete(pairing)).toBe(false)

    for (const playerId of playerIds) votesStore.setVotes(playerId, playerId, playerId)
    expect(isTableComplete(pairing)).toBe(true)
  })

  it('isTableComplete stays false if only some seated players have a commander set', () => {
    const { isTableComplete, rankingsStore, commandersStore, votesStore } = setupCompletion()
    const pairing: Pairing = makePairing()
    const playerIds = [1, 2, 3, 4]

    rankingsStore.setRankingWithRanks(1, playerIds.map(playerId => ({ playerId, rank: playerId })))
    for (const playerId of playerIds) votesStore.setVotes(playerId, playerId, playerId)
    commandersStore.setCommanders(1, 'Some Commander', null)

    expect(isTableComplete(pairing)).toBe(false)
  })
})
