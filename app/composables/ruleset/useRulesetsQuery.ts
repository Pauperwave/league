// app\composables\ruleset\useRulesetsQuery.ts
// Pinia Colada query for the rulesets list (ADR-015). Reads stay client →
// Supabase (ADR-013); this list is the single rulesets cache.
import type { Ruleset } from '#shared/utils/types'

/** Query key for the rulesets list — invalidated by useRulesetMutations. */
export const RULESETS_KEY = ['rulesets']

export function useRulesetsQuery() {
  const supabase = useSupabaseClient()

  return useQuery({
    key: RULESETS_KEY,
    query: async (): Promise<Ruleset[]> => {
      const { data, error } = await supabase
        .from('rulesets')
        .select('*')
        .order('ruleset_id')

      if (error) throw error
      return data ?? []
    },
  })
}
