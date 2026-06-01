// app\stores\rulesets.ts
import type { Ruleset } from '#shared/utils/types'
import { toErrorMessage } from '~/utils/error'

/**
 * Store for tournament ruleset management.
 * Handles CRUD operations for rulesets with usage validation on delete.
 */
export const useRulesetStore = defineStore('rulesets', () => {
  const supabase = useSupabaseClient()

  /** All rulesets fetched from Supabase */
  const rulesets = ref<Ruleset[]>([])
  /** Global loading state */
  const loading = ref(false)
  /** Last error message */
  const error = ref<string | null>(null)
  /** Whether initial fetch has completed */
  const initialized = ref(false)

  // ── Getters ────────────────────────────────────────────────────────────────

  /** Find a ruleset by its ruleset_id */
  const getRulesetById = computed(() => (id: number) => {
    return rulesets.value.find(r => r.ruleset_id === id) || null
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Fetch all rulesets from Supabase */
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
      error.value = toErrorMessage(err, 'Errore nel caricamento regolamenti')
      console.error('[useRulesetStore] fetchRulesets error:', err)
    } finally {
      loading.value = false
    }
  }

  /** Create a new ruleset */
  async function createRuleset(ruleset: Omit<Ruleset, 'ruleset_id'>): Promise<{ success: boolean; data?: Ruleset; error?: string }> {
    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('rulesets')
        .insert([ruleset])
        .select()
        .single()

      if (supaError) throw supaError
      if (!data) throw new Error('Nessun dato restituito dall\'inserimento')

      rulesets.value.push(data)
      return { success: true, data }
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nella creazione regolamento')
      console.error('[useRulesetStore] createRuleset error:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /** Update an existing ruleset */
  async function updateRuleset(id: number, updates: Partial<Ruleset>): Promise<{ success: boolean; data?: Ruleset; error?: string }> {
    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('rulesets')
        .update(updates)
        .eq('ruleset_id', id)
        .select()
        .single()

      if (supaError) throw supaError
      if (!data) throw new Error('Nessun dato restituito dall\'aggiornamento')

      const index = rulesets.value.findIndex(r => r.ruleset_id === id)
      if (index !== -1) {
        rulesets.value[index] = data
      }

      return { success: true, data }
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nell\'aggiornamento regolamento')
      console.error('[useRulesetStore] updateRuleset error:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a ruleset after checking it's not used by any league.
   * @returns Error if the ruleset is in use.
   */
  async function deleteRuleset(id: number): Promise<{ success: boolean; error?: string }> {
    loading.value = true
    error.value = null

    try {
      // Check if any league uses this ruleset
      const { data: leaguesUsing, error: checkError } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('ruleset_id', id)
        .limit(1)

      if (checkError) throw checkError

      if (leaguesUsing && leaguesUsing.length > 0) {
        return { success: false, error: 'Non è possibile eliminare questo regolamento perché è in uso da una o più leghe' }
      }

      const { error: supaError } = await supabase
        .from('rulesets')
        .delete()
        .eq('ruleset_id', id)

      if (supaError) throw supaError

      rulesets.value = rulesets.value.filter(r => r.ruleset_id !== id)

      return { success: true }
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nell\'eliminazione regolamento')
      console.error('[useRulesetStore] deleteRuleset error:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /** Clear the error state */
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
    createRuleset,
    updateRuleset,
    deleteRuleset,
    clearError
  }
})
