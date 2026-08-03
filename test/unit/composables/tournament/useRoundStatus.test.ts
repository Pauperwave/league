// test\unit\composables\tournament\useRoundStatus.test.ts
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { useRankingsStore } from '~/stores/rankings'
import { useCommandersStore } from '~/stores/commanders'
import { useVotesStore } from '~/stores/votes'
import { useRoundStatus } from '~/composables/tournament/useRoundStatus'
import type { PairingWithResults, PairingPlayer } from '#shared/utils/types'

function makePairing(overrides: Partial<PairingWithResults> = {}): PairingWithResults {
  return {
    event_id: 1,
    pairing_id: 1,
    pairing_round: 1,
    pairing_datetime: null,
    pairing_is_full: true,
    pairing_player1_id: 1,
    pairing_player2_id: 2,
    pairing_player3_id: null,
    pairing_player4_id: null,
    round_results: [],
    ...overrides,
  }
}

function makePlayer(id: number, name: string, surname: string): PairingPlayer {
  return { id, name, surname }
}

/** Mounts a throwaway component so the 3 session stores get a real, isolated Pinia instance. */
function setupRoundStatus(pairings: PairingWithResults[], players: PairingPlayer[]) {
  const pairingsRef = ref(pairings)
  const playersRef = ref(players)

  let roundStatus!: ReturnType<typeof useRoundStatus>
  let rankingsStore!: ReturnType<typeof useRankingsStore>
  let commandersStore!: ReturnType<typeof useCommandersStore>
  let votesStore!: ReturnType<typeof useVotesStore>

  mount(defineComponent({
    setup() {
      rankingsStore = useRankingsStore()
      commandersStore = useCommandersStore()
      votesStore = useVotesStore()
      roundStatus = useRoundStatus(
        pairingsRef, playersRef, rankingsStore, commandersStore, votesStore
      )
      return () => h('div')
    },
  }), {
    global: { plugins: [createPinia()] },
  })

  return { ...roundStatus, rankingsStore, commandersStore, votesStore }
}

describe('useRoundStatus', () => {
  const pairings = [
    makePairing({
      pairing_id: 10,
      pairing_player1_id: 1,
      pairing_player2_id: 2,
      pairing_player3_id: null,
      pairing_player4_id: null
    }),
    makePairing({
      pairing_id: 20,
      pairing_player1_id: 3,
      pairing_player2_id: 4,
      pairing_player3_id: null,
      pairing_player4_id: null
    }),
  ]
  const players = [
    makePlayer(1, 'Alessandro', 'Berti'),
    makePlayer(2, 'Federico', 'Toldo'),
    makePlayer(3, 'Gernot', 'Dalvai'),
    makePlayer(4, 'Elia', 'Pachera'),
  ]

  it('numbers rankingItems/killItems as 1-based table indices, in pairing order', () => {
    const { rankingItems, killItems } = setupRoundStatus(pairings, players)

    expect(
      rankingItems.value.map(i => ({ pairingId: i.pairingId, tableNumber: i.tableNumber }))
    ).toEqual([
      { pairingId: 10, tableNumber: 1 },
      { pairingId: 20, tableNumber: 2 },
    ])
    expect(killItems.value.map(i => i.tableNumber)).toEqual([1, 2])
  })

  it('rankingItems/killItems include seated players\' names, for search matching by surname', () => {
    const { rankingItems, killItems } = setupRoundStatus(pairings, players)

    expect(rankingItems.value.map(i => i.playerNames)).toEqual([
      ['Alessandro Berti', 'Federico Toldo'],
      ['Gernot Dalvai', 'Elia Pachera'],
    ])
    expect(killItems.value.map(i => i.playerNames)).toEqual([
      ['Alessandro Berti', 'Federico Toldo'],
      ['Gernot Dalvai', 'Elia Pachera'],
    ])
  })

  it('rankingItems.done reflects rankingsStore, per pairing', () => {
    const { rankingItems, rankingsStore } = setupRoundStatus(pairings, players)

    expect(rankingItems.value.every(i => !i.done)).toBe(true)

    rankingsStore.setRankingWithRanks(10, [{ playerId: 1, rank: 1 }, { playerId: 2, rank: 2 }])

    const [table1, table2] = rankingItems.value
    expect(table1?.done).toBe(true)
    expect(table2?.done).toBe(false)
  })

  it('killItems.done reflects round_results.number_of_kills, not killsStore', () => {
    const withConfirmedKills = [
      makePairing({
        pairing_id: 10,
        pairing_player3_id: null,
        pairing_player4_id: null,
        round_results: [{
          id: 1,
          pairing_id: 10,
          player_id: 1,
          position: 1,
          number_of_kills: 0,
          brew_vote: null,
          play_vote_1: null,
          play_vote_2: null,
          commander_1: null,
          commander_2: null
        }],
      }),
      makePairing({ pairing_id: 20, pairing_player3_id: null, pairing_player4_id: null }),
    ]

    const { killItems } = setupRoundStatus(withConfirmedKills, players)

    expect(killItems.value[0]?.done).toBe(true)
    expect(killItems.value[1]?.done).toBe(false)
  })

  it('commanderItems/voteItems list every seated player with their table number and name', () => {
    const { commanderItems } = setupRoundStatus(pairings, players)

    expect(commanderItems.value).toEqual([
      { pairingId: 10, playerId: 1, tableNumber: 1, name: 'Alessandro', surname: 'Berti', avatarUrl: undefined, done: false },
      { pairingId: 10, playerId: 2, tableNumber: 1, name: 'Federico', surname: 'Toldo', avatarUrl: undefined, done: false },
      { pairingId: 20, playerId: 3, tableNumber: 2, name: 'Gernot', surname: 'Dalvai', avatarUrl: undefined, done: false },
      { pairingId: 20, playerId: 4, tableNumber: 2, name: 'Elia', surname: 'Pachera', avatarUrl: undefined, done: false },
    ])
  })

  it('commanderItems.done reflects commandersStore.getCommander1 per player', () => {
    const { commanderItems, commandersStore } = setupRoundStatus(pairings, players)

    commandersStore.setCommanders(1, 'Atraxa', null)

    const byId = new Map(commanderItems.value.map(i => [i.playerId, i.done]))
    expect(byId.get(1)).toBe(true)
    expect(byId.get(2)).toBe(false)
  })

  it('voteItems.done reflects votesStore.hasVotes per player', () => {
    const { voteItems, votesStore } = setupRoundStatus(pairings, players)

    votesStore.setVotes(3, 4, 4)

    const byId = new Map(voteItems.value.map(i => [i.playerId, i.done]))
    expect(byId.get(3)).toBe(true)
    expect(byId.get(4)).toBe(false)
  })
})
