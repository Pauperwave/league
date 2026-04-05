import type { Ruleset } from '~/types/database'

/**
 * Composable per fetchare i regolamenti.
 * Usa lo store come single source of truth.
 */
export function useRulesets() {
  const store = useRulesetStore()

  const { data, pending, error } = useAsyncData<Ruleset[]>('rulesets', async () => {
    await store.fetchRulesets()
    return store.rulesets
  }, {
    server: true,
    default: () => []
  })

  return {
    data,
    pending,
    error,
    refresh: () => store.fetchRulesets(true)
  }
}
