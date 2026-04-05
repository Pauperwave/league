import type { Ruleset } from '~/types/database'

export const useRulesetStore = defineStore('rulesets', () => {
  const supabase = useSupabaseClient()

  // State
  const rulesets = ref<Ruleset[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  // Getters
  const getRulesetById = computed(() => (id: number) => {
    return rulesets.value.find(r => r.ruleset_id === id) || null
  })

  // Actions
  async function fetchRulesets(force = false) {
    if (initialized.value && !force) return

    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('rulesets')
        .select('*')
        .order('ruleset_id')

      if (supaError) throw supaError
      rulesets.value = data || []
      initialized.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore nel caricamento regolamenti'
      console.error('[useRulesetStore] fetchRulesets error:', err)
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    rulesets,
    loading,
    error,
    initialized,
    getRulesetById,
    fetchRulesets,
    clearError
  }
})
