// app\stores\players.ts
import { useI18n } from 'vue-i18n'
import type { Player, NewPlayer } from '#shared/utils/types'
import { toErrorMessage } from '~/utils/error'

/**
 * Sanitizes player names by replacing underscores with spaces.
 * The database uses underscores for compound names (e.g., "Mario_Rossi").
 * This transforms them to human-readable format (e.g., "Mario Rossi").
 */
export function sanitizePlayer<T extends Partial<Player>>(player: T): T {
  return {
    ...player,
    player_name: player.player_name?.replace(/_/g, ' ') ?? '',
    player_surname: player.player_surname?.replace(/_/g, ' ') ?? ''
  }
}

/**
 * Store for player management and event waitroom operations.
 * Handles player CRUD and waitroom state for events.
 */
export const usePlayerStore = defineStore('players', () => {
  const supabase = useSupabaseClient()
  const { t } = useI18n()

  /** All players fetched from Supabase (names sanitized) */
  const players = ref<Player[]>([])
  /** Player IDs in the current event waitroom */
  const waitingPlayers = ref<number[]>([])
  /** Map of playerId -> insertedAt timestamp for waitroom entries */
  const waitroomEntries = ref<Map<number, string>>(new Map())
  /** Global loading state */
  const loading = ref(false)
  /** Last error message */
  const error = ref<string | null>(null)
  /** Whether initial fetch has completed */
  const initialized = ref(false)

  // ── Getters ────────────────────────────────────────────────────────────────

  /** Find a player by ID */
  const getPlayerById = computed(() => (id: number) => {
    return players.value.find(p => p.player_id === id) || null
  })

  /** Find multiple players by IDs */
  const getPlayersByIds = computed(() => (ids: number[]) => {
    return players.value.filter(p => ids.includes(p.player_id))
  })

  /** Search players by name or surname */
  const searchPlayers = computed(() => (query: string) => {
    const lowerQuery = query.toLowerCase()
    return players.value.filter(
      p =>
        p.player_name.toLowerCase().includes(lowerQuery)
        || p.player_surname.toLowerCase().includes(lowerQuery)
        || `${p.player_name} ${p.player_surname}`.toLowerCase().includes(lowerQuery)
    )
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Fetch all players from Supabase and sanitize names */
  async function fetchPlayers(force = false) {
    if (initialized.value && !force) return

    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('players')
        .select('*')
        .order('player_name')

      if (supaError) throw supaError
      players.value = (data || []).map(p => sanitizePlayer(p))
      initialized.value = true
    } catch (err) {
      error.value = toErrorMessage(err, t('store.player.loadError'))
      console.error('[usePlayerStore] fetchPlayers error:', err)
    } finally {
      loading.value = false
    }
  }

  /** Create a new player and add to local state */
  async function createPlayer(player: NewPlayer) {
    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('players')
        .insert([{
          player_name: player.player_name,
          player_surname: player.player_surname
        }])
        .select()
        .single()

      if (supaError) throw supaError

      if (data) {
        const sanitized = sanitizePlayer(data)
        players.value.push(sanitized)
        return { success: true, data: sanitized }
      }
    } catch (err) {
      error.value = toErrorMessage(err, t('store.player.createError'))
      console.error('[usePlayerStore] createPlayer error:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /** Update an existing player */
  async function updatePlayer(playerId: number, player: NewPlayer) {
    loading.value = true
    error.value = null

    try {
      const { data, error: supaError } = await supabase
        .from('players')
        .update({
          player_name: player.player_name,
          player_surname: player.player_surname
        })
        .eq('player_id', playerId)
        .select()
        .single()

      if (supaError) throw supaError

      if (data) {
        const sanitized = sanitizePlayer(data)
        const index = players.value.findIndex(p => p.player_id === playerId)
        if (index !== -1) {
          players.value[index] = sanitized
        }
        return { success: true, data: sanitized }
      }
    } catch (err) {
      error.value = toErrorMessage(err, t('store.player.updateError'))
      console.error('[usePlayerStore] updatePlayer error:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  /** Load the waitroom players for a given event */
  async function fetchWaitingPlayers(eventId: number) {
    try {
      const { data, error: supaError } = await supabase
        .from('waitroom')
        .select('player_id, inserted_at')
        .eq('event_id', eventId)
        .order('inserted_at', { ascending: true })

      if (supaError) throw supaError

      waitingPlayers.value = data?.map(w => w.player_id) || []
      waitroomEntries.value = new Map(
        data?.map(w => [w.player_id, w.inserted_at || '']) || []
      )
    } catch (err) {
      console.error('[usePlayerStore] fetchWaitingPlayers error:', err)
    }
  }

  /** Add a player to an event's waitroom */
  async function addToWaitingList(eventId: number, playerId: number) {
    try {
      if (waitingPlayers.value.includes(playerId)) {
        return { success: false, error: t('store.player.alreadyInWaitingList') }
      }

      const { error } = await supabase.from('waitroom').insert([{
        event_id: eventId,
        player_id: playerId
      }])

      if (error) throw error
      waitingPlayers.value.push(playerId)
      waitroomEntries.value.set(playerId, new Date().toISOString())
      return { success: true }
    } catch (err) {
      console.error('[usePlayerStore] addToWaitingList error:', err)
      return { success: false }
    }
  }

  /** Remove a player from an event's waitroom */
  async function removeFromWaitingList(eventId: number, playerId: number) {
    try {
      const { error } = await supabase
        .from('waitroom')
        .delete()
        .eq('event_id', eventId)
        .eq('player_id', playerId)

      if (error) throw error
      waitingPlayers.value = waitingPlayers.value.filter(id => id !== playerId)
      waitroomEntries.value.delete(playerId)
      return { success: true }
    } catch (err) {
      console.error('[usePlayerStore] removeFromWaitingList error:', err)
      return { success: false }
    }
  }

  /** Clear the error state */
  function clearError() {
    error.value = null
  }

  return {
    players,
    waitingPlayers,
    waitroomEntries,
    loading,
    error,
    initialized,
    getPlayerById,
    getPlayersByIds,
    searchPlayers,
    fetchPlayers,
    createPlayer,
    updatePlayer,
    fetchWaitingPlayers,
    addToWaitingList,
    removeFromWaitingList,
    clearError
  }
})
