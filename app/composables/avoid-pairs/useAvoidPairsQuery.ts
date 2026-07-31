// app\composables\avoid-pairs\useAvoidPairsQuery.ts
// Pinia Colada query for the globally-fixed avoid-pairs list (ADR-015).
// Reads stay client → Supabase (ADR-013). This is the single source of
// truth for pairing constraints — replaces the old per-tournament
// localStorage forbidden-pairs list (pairingPreferences.ts).
import type { PairingForbiddenPair } from '#shared/utils/types'

/** Query key for the avoid-pairs list — invalidated by useAvoidPairsMutations. */
export const AVOID_PAIRS_KEY = ['avoid-pairs']

export function useAvoidPairsQuery() {
  const supabase = useSupabaseClient()

  return useQuery({
    key: AVOID_PAIRS_KEY,
    query: async (): Promise<PairingForbiddenPair[]> => {
      const { data, error } = await supabase
        .from('player_avoid_pairs')
        .select('player_a_id, player_b_id')

      if (error) throw error
      return (data ?? []).map(row => ({ playerA: row.player_a_id, playerB: row.player_b_id }))
    },
  })
}
