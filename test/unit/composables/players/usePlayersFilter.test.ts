// test\unit\composables\players\usePlayersFilter.test.ts
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { usePlayersFilter } from '~/composables/players/usePlayersFilter'
import type { Player } from '#shared/utils/types'

function makePlayer(id: number, name: string, surname: string, isActive = true): Player {
  return {
    player_id: id,
    player_name: name,
    player_surname: surname,
    is_active: isActive,
    formats_played: null,
  }
}

const deckCounts: Record<number, number> = { 1: 2, 2: 0, 3: 1 }

function getDeckCount(id: number): number {
  return deckCounts[id] ?? 0
}

function setupPlayersFilter(playersRef: Ref<Player[]>) {
  let result!: ReturnType<typeof usePlayersFilter>
  mount(defineComponent({
    setup() {
      result = usePlayersFilter(playersRef, getDeckCount)
      return () => h('div')
    },
  }))
  return result
}

describe('usePlayersFilter', () => {
  const players = ref<Player[]>([
    makePlayer(1, 'Bruno', 'Rossi'),
    makePlayer(2, 'Anna', 'Verdi'),
    makePlayer(3, 'Anna', 'Bianchi'),
  ])

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

    it('filters out inactive players when showOnlyActive is true', () => {
      const mixedActivity = ref<Player[]>([
        makePlayer(1, 'Bruno', 'Rossi', true),
        makePlayer(2, 'Anna', 'Verdi', false),
      ])
      const { showOnlyWithDecks, showOnlyActive, filteredPlayers } = setupPlayersFilter(mixedActivity)
      showOnlyWithDecks.value = false
      showOnlyActive.value = true

      expect(filteredPlayers.value.map(p => p.player_id)).toEqual([1])
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

    it('is no-active-filter when the active filter excludes everyone but players exist', () => {
      const onlyInactivePlayers = ref<Player[]>([makePlayer(2, 'Anna', 'Verdi', false)])
      const { showOnlyWithDecks, showOnlyActive, emptyState } = setupPlayersFilter(onlyInactivePlayers)
      showOnlyWithDecks.value = false
      showOnlyActive.value = true
      expect(emptyState.value).toBe('no-active-filter')
    })

    it('is no-players when there are no players at all', () => {
      const noPlayers = ref<Player[]>([])
      const { emptyState } = setupPlayersFilter(noPlayers)
      expect(emptyState.value).toBe('no-players')
    })
  })
})
