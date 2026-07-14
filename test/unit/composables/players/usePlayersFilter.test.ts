// test\unit\composables\players\usePlayersFilter.test.ts
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { usePlayersFilter } from '~/composables/players/usePlayersFilter'
import { createI18nTestPlugin } from '#test/helpers/mocks'
import type { Player } from '#shared/utils/types'

function makePlayer(id: number, name: string, surname: string): Player {
  return {
    player_id: id,
    player_name: name,
    player_surname: surname,
    is_active: true,
    formats_played: null,
  }
}

const stats: Record<number, Record<string, number>> = {
  1: { total_wins: 5, total_kills: 2, total_matches: 10, events_played: 3, average_score: 12 },
  2: { total_wins: 8, total_kills: 1, total_matches: 12, events_played: 4, average_score: 15 },
  3: { total_wins: 2, total_kills: 6, total_matches: 8, events_played: 2, average_score: 9 },
}

const deckCounts: Record<number, number> = { 1: 2, 2: 0, 3: 1 }

function getPlayerStat(id: number, key: string): number {
  return stats[id]?.[key] ?? 0
}

function getDeckCount(id: number): number {
  return deckCounts[id] ?? 0
}

function setupPlayersFilter(playersRef: Ref<Player[]>) {
  let result!: ReturnType<typeof usePlayersFilter>
  mount(defineComponent({
    setup() {
      result = usePlayersFilter(playersRef, getPlayerStat, getDeckCount)
      return () => h('div')
    },
  }), {
    global: { plugins: [createI18nTestPlugin()] },
  })
  return result
}

describe('usePlayersFilter', () => {
  const players = ref<Player[]>([
    makePlayer(1, 'Bruno', 'Rossi'),
    makePlayer(2, 'Anna', 'Verdi'),
    makePlayer(3, 'Anna', 'Bianchi'),
  ])

  describe('sortedPlayers (sort comparator)', () => {
    it('sorts by name ascending, breaking ties on surname', () => {
      const { sortBy, sortDirection, showOnlyWithDecks, filteredPlayers } = setupPlayersFilter(players)
      sortBy.value = 'name'
      sortDirection.value = 'asc'
      showOnlyWithDecks.value = false

      const names = filteredPlayers.value.map(p => `${p.player_name} ${p.player_surname}`)
      expect(names).toEqual(['Anna Bianchi', 'Anna Verdi', 'Bruno Rossi'])
    })

    it('sorts by name descending', () => {
      const { sortBy, sortDirection, filteredPlayers, showOnlyWithDecks } = setupPlayersFilter(players)
      sortBy.value = 'name'
      sortDirection.value = 'desc'
      showOnlyWithDecks.value = false

      const names = filteredPlayers.value.map(p => `${p.player_name} ${p.player_surname}`)
      expect(names).toEqual(['Bruno Rossi', 'Anna Verdi', 'Anna Bianchi'])
    })

    it('sorts by deck count, breaking ties on name', () => {
      const { sortBy, sortDirection, filteredPlayers, showOnlyWithDecks } = setupPlayersFilter(players)
      sortBy.value = 'decks'
      sortDirection.value = 'asc'
      showOnlyWithDecks.value = false

      // deckCounts: player 2 -> 0, player 3 -> 1, player 1 -> 2
      const ids = filteredPlayers.value.map(p => p.player_id)
      expect(ids).toEqual([2, 3, 1])
    })

    it('sorts by a stat field (wins)', () => {
      const { sortBy, sortDirection, filteredPlayers, showOnlyWithDecks } = setupPlayersFilter(players)
      sortBy.value = 'wins'
      sortDirection.value = 'desc'
      showOnlyWithDecks.value = false

      // total_wins: player1=5, player2=8, player3=2 -> desc: 2,1,3
      const ids = filteredPlayers.value.map(p => p.player_id)
      expect(ids).toEqual([2, 1, 3])
    })
  })

  describe('filteredPlayers (search + decks filter)', () => {
    it('filters by search query across name and surname, case-insensitively', () => {
      const { searchQuery, showOnlyWithDecks, filteredPlayers } = setupPlayersFilter(players)
      showOnlyWithDecks.value = false
      searchQuery.value = 'bian'

      expect(filteredPlayers.value.map(p => p.player_id)).toEqual([3])
    })

    it('filters out players with zero decks when showOnlyWithDecks is true', () => {
      const { showOnlyWithDecks, filteredPlayers } = setupPlayersFilter(players)
      showOnlyWithDecks.value = true

      // player 2 has 0 decks and should be excluded
      expect(filteredPlayers.value.map(p => p.player_id)).not.toContain(2)
      expect(filteredPlayers.value.map(p => p.player_id).sort()).toEqual([1, 3])
    })
  })

  describe('emptyState', () => {
    it('is null when there are results', () => {
      const { showOnlyWithDecks, emptyState } = setupPlayersFilter(players)
      showOnlyWithDecks.value = false
      expect(emptyState.value).toBeNull()
    })

    it('is no-search-results when a search query yields nothing', () => {
      const { showOnlyWithDecks, searchQuery, emptyState } = setupPlayersFilter(players)
      showOnlyWithDecks.value = false
      searchQuery.value = 'zzz-no-match'
      expect(emptyState.value).toBe('no-search-results')
    })

    it('is no-decks-filter when the deck filter excludes everyone but players exist', () => {
      const onlyDecklessPlayers = ref<Player[]>([makePlayer(2, 'Anna', 'Verdi')])
      const { showOnlyWithDecks, emptyState } = setupPlayersFilter(onlyDecklessPlayers)
      showOnlyWithDecks.value = true
      expect(emptyState.value).toBe('no-decks-filter')
    })

    it('is no-players when there are no players at all', () => {
      const noPlayers = ref<Player[]>([])
      const { emptyState } = setupPlayersFilter(noPlayers)
      expect(emptyState.value).toBe('no-players')
    })
  })
})
