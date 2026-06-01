// app\stores\commander-decks.ts
import { toErrorMessage } from '~/utils/error'
import type { CommanderDeck } from '#shared/utils/types'
import { applyCommander2Filter } from '~/composables/supabase/useStatsQueryBuilder'

/**
 * Store for commander deck management.
 * Handles CRUD for player commander decks stored in the commander_decks table.
 */
export const useCommanderDeckStore = defineStore('commanderDecks', () => {
  const supabase = useSupabaseClient()

  /** All commander decks fetched from Supabase */
  const decks = ref<CommanderDeck[]>([])
  /** Global loading state */
  const loading = ref(false)
  /** Last error message */
  const error = ref<string | null>(null)
  /** Whether initial fetch has completed */
  const initialized = ref(false)

  // ── Getters ────────────────────────────────────────────────────────────────

  /** Find decks by player ID */
  const getDecksByPlayerId = computed(() => (playerId: number) => {
    return decks.value.filter((d: CommanderDeck) => d.player_id === playerId)
  })

  /** Get a single deck by ID */
  const getDeckById = computed(() => (id: number) => {
    return decks.value.find((d: CommanderDeck) => d.id === id) || null
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Fetch all commander decks from Supabase */
  async function fetchDecks(force = false) {
    if (initialized.value && !force) return

    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('commander_decks')
        .select('*')
        .order('created_at', { ascending: false })

      if (supaError) throw supaError
      decks.value = data || []
      initialized.value = true
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nel caricamento dei deck')
      console.error('[useCommanderDeckStore] fetchDecks error:', err)
    } finally {
      loading.value = false
    }
  }

  /** Fetch decks for a specific player */
  async function fetchDecksByPlayer(playerId: number) {
    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('commander_decks')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })

      if (supaError) throw supaError

      // Merge into existing decks, replacing any with same ID
      const newDecks = (data || []) as CommanderDeck[]
      const existingIds = new Set(decks.value.map((d: CommanderDeck) => d.id))
      for (const deck of newDecks) {
        if (existingIds.has(deck.id)) {
          const idx = decks.value.findIndex((d: CommanderDeck) => d.id === deck.id)
          if (idx !== -1) decks.value[idx] = deck
        } else {
          decks.value.push(deck)
        }
      }
      return newDecks
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nel caricamento dei deck')
      console.error('[useCommanderDeckStore] fetchDecksByPlayer error:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  /** Create a new commander deck */
  async function createDeck(deck: Omit<CommanderDeck, 'id' | 'uuid' | 'created_at' | 'updated_at'>) {
    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('commander_decks')
        .insert([deck])
        .select()
        .single()

      if (supaError) throw supaError

      if (data) {
        decks.value.push(data)
        return { success: true as const, data }
      }
      return { success: false as const, error: 'Nessun dato restituito' }
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nella creazione del deck')
      console.error('[useCommanderDeckStore] createDeck error:', err)
      return { success: false as const, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /** Update an existing commander deck */
  async function updateDeck(id: number, updates: Partial<CommanderDeck>) {
    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('commander_decks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (supaError) throw supaError

      if (data) {
        const index = decks.value.findIndex((d: CommanderDeck) => d.id === id)
        if (index !== -1) {
          decks.value[index] = data as CommanderDeck
        }
        return { success: true as const, data }
      }
      return { success: false as const, error: 'Nessun dato restituito' }
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nella modifica del deck')
      console.error('[useCommanderDeckStore] updateDeck error:', err)
      return { success: false as const, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Check if a deck is used in any event (round_results).
   * Decks are matched by player_id + commander names.
   */
  async function isDeckInUse(deck: CommanderDeck): Promise<boolean> {
    try {
      const query = applyCommander2Filter(
        supabase
          .from('round_results')
          .select('id', { count: 'exact', head: true })
          .eq('player_id', deck.player_id)
          .eq('commander_1', deck.commander_1_name),
        deck.commander_2_name
      )
      const { data, error: supaError } = await query.limit(1)

      if (supaError) throw supaError
      return (data && data.length > 0) || false
    } catch (err) {
      console.error('[useCommanderDeckStore] isDeckInUse error:', err)
      return true // Safer to assume in use on error
    }
  }

  /**
   * Delete a commander deck if it is not used in any event.
   * @returns Error if the deck is in use.
   */
  async function deleteDeck(id: number) {
    loading.value = true
    error.value = null

    try {
      const deck = decks.value.find((d: CommanderDeck) => d.id === id)
      if (!deck) {
        return { success: false as const, error: 'Deck non trovato' }
      }

      // Check if deck is used in any event
      const inUse = await isDeckInUse(deck)
      if (inUse) {
        return { success: false, error: 'Non è possibile eliminare questo deck perché è stato usato in un evento' }
      }

      const { error: supaError } = await supabase
        .from('commander_decks')
        .delete()
        .eq('id', id)

      if (supaError) throw supaError

      decks.value = decks.value.filter((d: CommanderDeck) => d.id !== id)
      return { success: true }
    } catch (err) {
      error.value = toErrorMessage(err, 'Errore nella eliminazione del deck')
      console.error('[useCommanderDeckStore] deleteDeck error:', err)
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
    decks,
    loading,
    error,
    initialized,
    getDecksByPlayerId,
    getDeckById,
    fetchDecks,
    fetchDecksByPlayer,
    createDeck,
    updateDeck,
    deleteDeck,
    isDeckInUse,
    clearError
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCommanderDeckStore, import.meta.hot))
}
