// app\composables\league\useLeaguesQuery.ts
// Pinia Colada query for the leagues list (ADR-015). Reads stay client →
// Supabase (ADR-013); this list is the single leagues cache — detail views
// derive from it via useLeagueById instead of fetching per id.
import type { League } from '#shared/utils/types'

/** Query key for the leagues list — invalidated by useLeagueMutations. */
export const LEAGUES_KEY = ['leagues']

export function useLeaguesQuery() {
  const supabase = useSupabaseClient()

  return useQuery({
    key: LEAGUES_KEY,
    query: async (): Promise<League[]> => {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .order('starts_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * A single league resolved from the cached list (no per-id fetch — the
 * whole table is a handful of rows).
 */
export function useLeagueById(leagueId: number) {
  const { data, ...rest } = useLeaguesQuery()
  const league = computed(() => data.value?.find(l => l.id === leagueId) ?? null)
  return { league, ...rest }
}
