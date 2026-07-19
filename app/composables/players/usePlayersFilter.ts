// app\composables\players\usePlayersFilter.ts

import type { Player } from '#shared/utils/types'

/**
 * Encapsulates search and filter logic for a player list. Sorting is handled
 * by PlayersTable's own sortable columns (TanStack), not here — this used to
 * also own a manual sortBy/sortDirection pair, removed once the table gained
 * clickable column headers (2026-07-19).
 * Accepts reactive data as params to avoid coupling to specific stores.
 */
export function usePlayersFilter(
  players: Ref<Player[]>,
  getDeckCount: (id: number) => number
) {
  const searchQuery = ref('')
  const showOnlyWithDecks = ref(true)
  const showOnlyActive = ref(true)

  const filteredPlayers = computed(() => {
    let result = players.value
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      result = result.filter(p =>
        `${p.player_name ?? ''} ${p.player_surname ?? ''}`.toLowerCase().includes(q)
      )
    }
    if (showOnlyWithDecks.value) {
      result = result.filter(p => getDeckCount(p.player_id) > 0)
    }
    if (showOnlyActive.value) {
      result = result.filter(p => p.is_active)
    }
    return result
  })

  const emptyState = computed((): 'no-search-results' | 'no-decks-filter' | 'no-active-filter' | 'no-players' | null => {
    if (filteredPlayers.value.length > 0) return null
    if (searchQuery.value.trim()) return 'no-search-results'
    if (showOnlyWithDecks.value && players.value.length > 0) return 'no-decks-filter'
    if (showOnlyActive.value && players.value.length > 0) return 'no-active-filter'
    return 'no-players'
  })

  return {
    searchQuery, showOnlyWithDecks, showOnlyActive,
    filteredPlayers, emptyState
  }
}
