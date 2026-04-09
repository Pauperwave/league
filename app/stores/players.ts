import type { Player, NewPlayer } from '#shared/utils/types'

/**
 * Sanitizza i nomi dei giocatori sostituendo gli underscore con spazi.
 * Il database usa underscore per nomi composti (es. "Mario_Rossi").
 * Questa funzione trasforma in formato leggibile (es. "Mario Rossi").
 */
export function sanitizePlayer<T extends Partial<Player>>(player: T): T {
  return {
    ...player,
    player_name: player.player_name?.replace(/_/g, ' ') ?? '',
    player_surname: player.player_surname?.replace(/_/g, ' ') ?? ''
  }
}

export const usePlayerStore = defineStore('players', () => {
  const supabase = useSupabaseClient()

  // State
  const players = ref<Player[]>([])
  const waitingPlayers = ref<number[]>([])
  const waitroomEntries = ref<Map<number, string>>(new Map()) // playerId -> insertedAt
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  // Getters
  const getPlayerById = computed(() => (id: number) => {
    return players.value.find(p => p.player_id === id) || null
  })

  const getPlayersByIds = computed(() => (ids: number[]) => {
    return players.value.filter(p => ids.includes(p.player_id))
  })

  const searchPlayers = computed(() => (query: string) => {
    const lowerQuery = query.toLowerCase()
    return players.value.filter(
      p =>
        p.player_name.toLowerCase().includes(lowerQuery)
        || p.player_surname.toLowerCase().includes(lowerQuery)
        || `${p.player_name} ${p.player_surname}`.toLowerCase().includes(lowerQuery)
    )
  })

  // Actions
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
      players.value = (data || []).map(p => ({
        ...p,
        player_name: p.player_name?.replace(/_/g, ' ') ?? '',
        player_surname: p.player_surname?.replace(/_/g, ' ') ?? ''
      }))
      initialized.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore nel caricamento giocatori'
      console.error('[usePlayerStore] fetchPlayers error:', err)
    } finally {
      loading.value = false
    }
  }

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
        const sanitized = {
          ...data,
          player_name: data.player_name?.replace(/_/g, ' ') ?? '',
          player_surname: data.player_surname?.replace(/_/g, ' ') ?? ''
        }
        players.value.push(sanitized)
        return { success: true, data: sanitized }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Errore nella creazione giocatore'
      console.error('[usePlayerStore] createPlayer error:', err)
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

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

  async function addToWaitingList(eventId: number, playerId: number) {
    try {
      if (waitingPlayers.value.includes(playerId)) {
        return { success: false, error: 'Player already in waiting list' }
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
    fetchWaitingPlayers,
    addToWaitingList,
    removeFromWaitingList,
    clearError
  }
})
