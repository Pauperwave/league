// app\stores\commander-decks.ts
// fallow-ignore-file code-duplication -- intentional store CRUD boilerplate, see app/stores/CLAUDE.md
import type { CommanderDeck } from '#shared/utils/types'

/**
 * Store for commander deck management.
 * Handles CRUD for player commander decks stored in the commander_decks table.
 */
export const useCommanderDeckStore = defineStore('commanderDecks', () => {
  const supabase = useSupabaseClient()
  const { t } = useI18n()

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
      error.value = toErrorMessage(err, t('store.deck.loadError'))
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
      error.value = toErrorMessage(err, t('store.deck.loadError'))
      console.error('[useCommanderDeckStore] fetchDecksByPlayer error:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  /** Create a new commander deck via the BFF endpoint (ADR-013) */
  async function createDeck(deck: Omit<CommanderDeck, 'id' | 'uuid' | 'created_at' | 'updated_at'>) {
    loading.value = true
    error.value = null

    try {
      const { deck: created } = await $fetch('/api/decks/create', {
        method: 'POST',
        body: deck,
      })

      decks.value.push(created)
      return { success: true as const, data: created }
    } catch (err) {
      error.value = toErrorMessage(err, t('store.deck.createError'))
      console.error('[useCommanderDeckStore] createDeck error:', err)
      return { success: false as const, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /** Update an existing commander deck via the BFF endpoint (ADR-013) */
  async function updateDeck(id: number, updates: Partial<CommanderDeck>) {
    loading.value = true
    error.value = null

    try {
      const { deck: updated } = await $fetch<{ deck: CommanderDeck }>(`/api/decks/${id}/update` as string, {
        method: 'POST',
        body: updates,
      })

      const index = decks.value.findIndex((d: CommanderDeck) => d.id === id)
      if (index !== -1) {
        decks.value[index] = updated
      }
      return { success: true as const, data: updated }
    } catch (err) {
      error.value = toErrorMessage(err, t('store.deck.updateError'))
      console.error('[useCommanderDeckStore] updateDeck error:', err)
      return { success: false as const, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a commander deck via the BFF endpoint (ADR-013). The "deck was
   * played in an event" guard is server-side now — the endpoint answers 409
   * for that case, mapped here onto the existing Italian copy.
   */
  async function deleteDeck(id: number) {
    loading.value = true
    error.value = null

    try {
      await $fetch<{ deleted: boolean }>(`/api/decks/${id}/delete` as string, { method: 'POST' })

      decks.value = decks.value.filter((d: CommanderDeck) => d.id !== id)
      return { success: true }
    } catch (err) {
      const inUse = typeof err === 'object' && err !== null
        && 'statusCode' in err && (err as { statusCode?: number }).statusCode === 409
      error.value = inUse
        ? t('store.deck.inUseError')
        : toErrorMessage(err, t('store.deck.deleteError'))
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
    clearError
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCommanderDeckStore, import.meta.hot))
}
