import type { Ruleset } from '#shared/utils/types'

/**
 * Composable per gestire i dati dei regolamenti.
 * Usa lo store come single source of truth.
 * Il fetching è gestito via useAsyncData per SSR.
 */
export function useRulesets() {
  const store = useRulesetStore()
  const supabase = useSupabaseClient()

  // Load both rulesets and leagues data together to prevent SSR mismatch
  const { data, pending, error } = useAsyncData<{ rulesets: Ruleset[]; leagues: any[] }>('rulesets-with-leagues', async () => {
    // Load rulesets
    await store.fetchRulesets()

    // Load leagues
    const { data: leaguesData } = await supabase
      .from('leagues')
      .select('id, name, ruleset_id')
      .not('ruleset_id', 'is', null)

    return {
      rulesets: store.rulesets,
      leagues: leaguesData || []
    }
    // No side effects — just return the data
  }, {
    server: true,
    default: () => ({ rulesets: [], leagues: [] })
  })

  // New page-level state and methods
  const showFormModal = ref(false)
  const showDeleteConfirm = ref(false)
  const rulesetToEdit = ref<Ruleset | null>(null)
  const rulesetToDelete = ref<Ruleset | null>(null)

  const rulesets = computed(() => data.value?.rulesets || [])
  const errorMessage = computed(() => error.value?.message ?? store.error ?? 'Errore nel caricamento')

  // Derived from hydrated data, always in sync on both server and client
  const usedRulesetIds = computed(() => {
    return new Set(
      (data.value?.leagues || [])
        .map(l => l.ruleset_id)
        .filter(Boolean) as number[]
    )
  })

  const leaguesMap = computed(() => {
    const map = new Map<number, { id: number; name: string }[]>()
    for (const league of data.value?.leagues || []) {
      if (league.ruleset_id) {
        if (!map.has(league.ruleset_id)) map.set(league.ruleset_id, [])
        map.get(league.ruleset_id)!.push({ id: league.id, name: league.name })
      }
    }
    return map
  })

  function refreshLeagues() {
    refreshNuxtData('rulesets-with-leagues')
  }

  function isRulesetInUse(rulesetId: number): boolean {
    return usedRulesetIds.value.has(rulesetId)
  }

  function getLeaguesByRuleset(rulesetId: number): { id: number; name: string }[] {
    return leaguesMap.value.get(rulesetId) || []
  }

  async function handleCreateRuleset(rulesetData: Omit<Ruleset, 'ruleset_id'>) {
    const result = await store.createRuleset(rulesetData)

    if (result.success) {
      showFormModal.value = false
      rulesetToEdit.value = null
    }

    return result
  }

  function handleEditClick(ruleset: Ruleset | null) {
    rulesetToEdit.value = ruleset
    showFormModal.value = true
  }

  async function handleUpdateRuleset({ id, data }: { id: number; data: Partial<Ruleset> }) {
    const result = await store.updateRuleset(id, data)

    if (result.success) {
      showFormModal.value = false
      rulesetToEdit.value = null
    }

    return result
  }

  function handleDeleteClick(ruleset: Ruleset) {
    rulesetToDelete.value = ruleset
    showDeleteConfirm.value = true
  }

  async function confirmDeleteRuleset() {
    if (!rulesetToDelete.value) return { success: false }

    const result = await store.deleteRuleset(rulesetToDelete.value.ruleset_id)

    if (result.success) {
      rulesetToDelete.value = null
      showDeleteConfirm.value = false
    }

    return result
  }

  return {
    pending,
    loading: pending, // Alias for consistency
    error,
    refresh: () => store.fetchRulesets(true),

    // New interface for rulesets page
    rulesets,
    errorMessage,
    showFormModal,
    showDeleteConfirm,
    rulesetToEdit,
    rulesetToDelete,
    usedRulesetIds,
    leaguesMap,
    isRulesetInUse,
    getLeaguesByRuleset,
    refreshLeagues,
    handleCreateRuleset,
    handleEditClick,
    handleUpdateRuleset,
    handleDeleteClick,
    confirmDeleteRuleset
  }
}
