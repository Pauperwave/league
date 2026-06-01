// app\composables\usePlayersFilter.ts

import type { Player } from '#shared/utils/types'

export type SortField = 'name' | 'wins' | 'kills' | 'matches' | 'events' | 'avgScore' | 'decks'

export const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Nome', value: 'name' },
  { label: 'Vittorie', value: 'wins' },
  { label: 'Uccisioni', value: 'kills' },
  { label: 'Partite', value: 'matches' },
  { label: 'Eventi', value: 'events' },
  { label: 'Media punti', value: 'avgScore' },
  { label: 'Mazzi', value: 'decks' },
]

/**
 * Encapsulates search, filter, and sorting logic for a player list.
 * Accepts reactive data as params to avoid coupling to specific stores.
 */
export function usePlayersFilter(
  players: Ref<Player[]>,
  getPlayerStat: (id: number, key: string) => number,
  getDeckCount: (id: number) => number
) {
  const searchQuery = ref('')
  const showOnlyWithDecks = ref(true)
  const sortBy = ref<SortField>('name')
  const sortDirection = ref<'asc' | 'desc'>('asc')

  const sortedPlayers = computed(() => {
    const list = [...players.value]
    const dir = sortDirection.value === 'asc' ? 1 : -1
    const statKey: Record<string, string> = {
      wins: 'total_wins', kills: 'total_kills',
      matches: 'total_matches', events: 'events_played', avgScore: 'average_score'
    }

    return list.sort((a, b) => {
      if (sortBy.value === 'name') {
        const n = (a.player_name ?? '').localeCompare(b.player_name ?? '') * dir
        return n !== 0 ? n : (a.player_surname ?? '').localeCompare(b.player_surname ?? '') * dir
      }
      if (sortBy.value === 'decks') {
        const diff = getDeckCount(a.player_id) - getDeckCount(b.player_id)
        return diff !== 0 ? diff * dir : (a.player_name ?? '').localeCompare(b.player_name ?? '')
      }
      const key = statKey[sortBy.value] as string
      const diff = getPlayerStat(a.player_id, key) - getPlayerStat(b.player_id, key)
      return diff !== 0 ? diff * dir : (a.player_name ?? '').localeCompare(b.player_name ?? '')
    })
  })

  const filteredPlayers = computed(() => {
    let result = sortedPlayers.value
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      result = result.filter(p =>
        `${p.player_name ?? ''} ${p.player_surname ?? ''}`.toLowerCase().includes(q)
      )
    }
    if (showOnlyWithDecks.value) {
      result = result.filter(p => getDeckCount(p.player_id) > 0)
    }
    return result
  })

  const emptyState = computed((): 'no-search-results' | 'no-decks-filter' | 'no-players' | null => {
    if (filteredPlayers.value.length > 0) return null
    if (searchQuery.value.trim()) return 'no-search-results'
    if (showOnlyWithDecks.value && sortedPlayers.value.length > 0) return 'no-decks-filter'
    return 'no-players'
  })

  function getSortLabel(value: string) {
    return SORT_OPTIONS.find(o => o.value === value)?.label ?? value
  }

  function toggleDirection() {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  }

  return {
    searchQuery, showOnlyWithDecks, sortBy, sortDirection,
    filteredPlayers, emptyState, getSortLabel, toggleDirection
  }
}
