// app\composables\deck\useDecksQuery.ts
// Pinia Colada query for the commander-decks list (ADR-015). Reads stay
// client → Supabase (ADR-013); this list is the single decks cache — every
// per-player view derives from it.
import type { CommanderDeck } from '#shared/utils/types'

/** Query key for the decks list — invalidated by useDeckMutations. */
export const DECKS_KEY = ['decks']

export function useDecksQuery() {
  const supabase = useSupabaseClient()

  return useQuery({
    key: DECKS_KEY,
    query: async (): Promise<CommanderDeck[]> => {
      const { data, error } = await supabase
        .from('commander_decks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

/** A single player's decks, derived from the cached list. */
export function usePlayerDecks(playerId: Ref<number | undefined>) {
  const { data, ...rest } = useDecksQuery()
  const decks = computed(() =>
    playerId.value ? (data.value ?? []).filter(d => d.player_id === playerId.value) : []
  )
  return { decks, ...rest }
}
