// test\unit\composables\event\useSessionStorePersistence.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { mount } from '@vue/test-utils'
import {
  useSessionStorePersistence,
  sessionSnapshotKey,
  type SessionSnapshot,
} from '~/composables/event/useSessionStorePersistence'
import { setCached, getCached } from '~/utils/localStorage'
import type { RankingEntry } from '~/stores/rankings'
import type { CommanderEntry } from '~/stores/commanders'
import type { VoteEntry } from '~/stores/votes'
import type { Kill } from '#shared/utils/types'

const EVENT_ID = 42
const KEY = sessionSnapshotKey(EVENT_ID)
const TTL = 12 * 60 * 60 * 1000

/** Reactive fakes matching the structural store interfaces the composable uses. */
function makeFakeStores() {
  const rankingsStore = reactive({
    rankingsWithRanks: new Map<number, RankingEntry[]>(),
    hydrate(entries: [number, RankingEntry[]][]) {
      this.rankingsWithRanks = new Map(entries)
    },
  })
  const killsStore = reactive({
    kills: [] as Kill[],
    confirmedPairings: new Set<number>(),
    hydrate(snapshot: { kills: Kill[]; confirmedPairings: number[] }) {
      this.kills = [...snapshot.kills]
      this.confirmedPairings = new Set(snapshot.confirmedPairings)
    },
  })
  const commandersStore = reactive({
    commanders: new Map<number, CommanderEntry>(),
    hydrate(entries: CommanderEntry[]) {
      this.commanders = new Map(entries.map(entry => [entry.playerId, entry]))
    },
  })
  const votesStore = reactive({
    votes: new Map<number, VoteEntry>(),
    hydrate(entries: VoteEntry[]) {
      this.votes = new Map(entries.map(entry => [entry.playerId, entry]))
    },
  })
  return { rankingsStore, killsStore, commandersStore, votesStore }
}

function mountWithPersistence(stores: ReturnType<typeof makeFakeStores>, round = 1) {
  const currentRound = ref(round)
  const Host = defineComponent({
    setup() {
      useSessionStorePersistence({ eventId: EVENT_ID, currentRound, ...stores })
      return () => h('div')
    },
  })
  return { wrapper: mount(Host), currentRound }
}

function snapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    round: 1,
    rankings: [[7, [{ playerId: 1, rank: 1 }, { playerId: 2, rank: 2 }]]],
    kills: [{ killerId: 1, victimId: 2 }],
    confirmedPairings: [7],
    commanders: [{ playerId: 1, commander1: 'Atraxa', commander2: null }],
    votes: [{ playerId: 1, deckVotePlayerId: 2, playVotePlayerId: 2 }],
    ...overrides,
  }
}

describe('useSessionStorePersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('hydrates all stores on mount when the saved round matches', () => {
    setCached(KEY, snapshot())
    const stores = makeFakeStores()
    mountWithPersistence(stores, 1)

    expect(stores.rankingsStore.rankingsWithRanks.get(7)).toEqual([
      { playerId: 1, rank: 1 },
      { playerId: 2, rank: 2 },
    ])
    expect(stores.killsStore.kills).toEqual([{ killerId: 1, victimId: 2 }])
    expect(stores.killsStore.confirmedPairings.has(7)).toBe(true)
    expect(stores.commandersStore.commanders.get(1)?.commander1).toBe('Atraxa')
    expect(stores.votesStore.votes.get(1)?.deckVotePlayerId).toBe(2)
  })

  it('skips hydration when the saved round differs from the current round', () => {
    setCached(KEY, snapshot({ round: 1 }))
    const stores = makeFakeStores()
    mountWithPersistence(stores, 2)

    expect(stores.rankingsStore.rankingsWithRanks.size).toBe(0)
    expect(stores.killsStore.kills).toEqual([])
  })

  it('persists a snapshot when a store changes after mount', async () => {
    const stores = makeFakeStores()
    mountWithPersistence(stores, 3)
    expect(getCached<SessionSnapshot>(KEY, TTL)).toBeNull()

    stores.killsStore.kills.push({ killerId: 5, victimId: 6 })
    await nextTick()

    const saved = getCached<SessionSnapshot>(KEY, TTL)
    expect(saved?.round).toBe(3)
    expect(saved?.kills).toEqual([{ killerId: 5, victimId: 6 }])
  })

  it('round-trips Map/Set state through persistence and hydration', async () => {
    const stores = makeFakeStores()
    mountWithPersistence(stores, 1)

    stores.rankingsStore.rankingsWithRanks.set(9, [{ playerId: 3, rank: 1 }])
    stores.killsStore.confirmedPairings.add(9)
    stores.commandersStore.commanders.set(3, { playerId: 3, commander1: 'Krenko', commander2: null })
    stores.votesStore.votes.set(3, { playerId: 3, deckVotePlayerId: null, playVotePlayerId: 4 })
    await nextTick()

    // Fresh stores simulating a page refresh
    const freshStores = makeFakeStores()
    mountWithPersistence(freshStores, 1)

    expect(freshStores.rankingsStore.rankingsWithRanks.get(9)).toEqual([{ playerId: 3, rank: 1 }])
    expect(freshStores.killsStore.confirmedPairings.has(9)).toBe(true)
    expect(freshStores.commandersStore.commanders.get(3)?.commander1).toBe('Krenko')
    expect(freshStores.votesStore.votes.get(3)?.playVotePlayerId).toBe(4)
  })

  it('overwrites the snapshot with empty state after a reset-style change (round advance)', async () => {
    setCached(KEY, snapshot({ round: 1 }))
    const stores = makeFakeStores()
    const { currentRound } = mountWithPersistence(stores, 1)

    // Simulate confirmNextRound: round advances, then stores are reset
    currentRound.value = 2
    stores.rankingsStore.rankingsWithRanks = new Map()
    stores.killsStore.kills = []
    stores.killsStore.confirmedPairings = new Set()
    await nextTick()

    const saved = getCached<SessionSnapshot>(KEY, TTL)
    expect(saved?.round).toBe(2)
    expect(saved?.rankings).toEqual([])
    expect(saved?.kills).toEqual([])
  })
})
