import type { League, LeagueInsert } from '#shared/utils/types'
import { toErrorMessage } from '~/utils/error'

/**
 * Store for league management.
 * Handles CRUD operations for leagues with per-action loading flags.
 */
export const useLeagueStore = defineStore('leagues', () => {
  const supabase = useSupabaseClient()

  /** All leagues fetched from Supabase */
  const leagues = ref<League[]>([])
  /** Currently selected league */
  const currentLeague = ref<League | null>(null)
  /** Last error message */
  const error = ref<string | null>(null)
  /** Whether initial fetch has completed */
  const initialized = ref(false)

  // Per-action loading flags
  const loadingFetch = ref(false)
  const loadingCreate = ref(false)
  const loadingUpdate = ref(false)
  const loadingDelete = ref(false)

  /** True if any action is currently loading */
  const loading = computed(() => loadingFetch.value || loadingCreate.value || loadingUpdate.value || loadingDelete.value)

  // ── Getters ────────────────────────────────────────────────────────────────

  /** Find a league by its ID */
  function getLeagueById(id: number): League | null {
    return leagues.value.find(l => l.id === id) ?? null
  }

  /**
   * Leagues sorted by start date (newest first).
   * Re-sorted locally to keep consistency after mutations (unshift, filter, etc.).
   */
  const sortedLeagues = computed(() => {
    return [...leagues.value].sort((a, b) => {
      const dateA = a.starts_at ? new Date(a.starts_at).getTime() : 0
      const dateB = b.starts_at ? new Date(b.starts_at).getTime() : 0
      return dateB - dateA
    })
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Fetch all leagues from Supabase */
  async function fetchLeagues(force = false) {
    if (initialized.value && !force) return

    loadingFetch.value = true
    error.value = null

    try {
      const { data, error: err } = await supabase
        .from('leagues')
        .select('*')
        .order('starts_at', { ascending: false })

      if (err) throw err

      leagues.value = data ?? []
      initialized.value = true
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nel caricamento leghe')
      console.error('[useLeagueStore] fetchLeagues error:', err)
    } finally {
      loadingFetch.value = false
    }
  }

  /** Create a new league and add it to local state */
  async function createLeague(league: LeagueInsert): Promise<{ success: boolean; data?: League; error?: string }> {
    loadingCreate.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('leagues')
        .insert([league])
        .select()
        .single()

      if (supaError) throw supaError
      if (!data) throw new Error('Nessun dato restituito dall\'inserimento')

      leagues.value.push(data)
      // sortedLeagues computed will re-sort automatically
      return { success: true, data }
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nella creazione lega')
      console.error('[useLeagueStore] createLeague error:', err)
      return { success: false, error: error.value }
    } finally {
      loadingCreate.value = false
    }
  }

  /** Update an existing league in Supabase and local state */
  async function updateLeague(id: number, updates: Partial<League>): Promise<{ success: boolean; data?: League; error?: string }> {
    loadingUpdate.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('leagues')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (supaError) throw supaError
      if (!data) throw new Error('Nessun dato restituito dall\'aggiornamento')

      const index = leagues.value.findIndex(l => l.id === id)
      if (index !== -1) {
        leagues.value[index] = data
      }

      if (currentLeague.value?.id === id) {
        currentLeague.value = data
      }

      return { success: true, data }
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nell\'aggiornamento lega')
      console.error('[useLeagueStore] updateLeague error:', err)
      return { success: false, error: error.value }
    } finally {
      loadingUpdate.value = false
    }
  }

  /** Delete a league by ID */
  async function deleteLeague(id: number): Promise<{ success: boolean; error?: string }> {
    loadingDelete.value = true
    error.value = null

    try {
      const { error: supaError } = await supabase
        .from('leagues')
        .delete()
        .eq('id', id)

      if (supaError) throw supaError

      leagues.value = leagues.value.filter(l => l.id !== id)

      if (currentLeague.value?.id === id) {
        currentLeague.value = null
      }

      return { success: true }
    } catch (err) {
      error.value = toErrorMessage(err, "Errore nell'eliminazione lega")
      console.error('[useLeagueStore] deleteLeague error:', err)
      return { success: false, error: error.value }
    } finally {
      loadingDelete.value = false
    }
  }

  /** Set the currently selected league */
  function setCurrentLeague(league: League | null) {
    currentLeague.value = league
  }

  /** Clear the error state */
  function clearError() {
    error.value = null
  }

  return {
    // State
    leagues,
    currentLeague,
    error,
    // Loading
    loading,
    loadingFetch,
    loadingCreate,
    loadingUpdate,
    loadingDelete,
    // Getters
    getLeagueById,
    sortedLeagues,
    // Actions
    fetchLeagues,
    createLeague,
    updateLeague,
    deleteLeague,
    setCurrentLeague,
    clearError
  }
})
