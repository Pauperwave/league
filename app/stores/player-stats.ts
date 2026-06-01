// app/stores/player-stats.ts

import type { PlayerStat } from '#shared/utils/types'

/**
 * Pinia store for player statistics fetched from the `player_stats` denormalized table.
 * Caches stats across page navigations to avoid repeated fetches.
 */
export const usePlayerStatsStore = defineStore('playerStats', () => {
  const supabase = useSupabaseClient()

  /** All player stats loaded from the database */
  const stats = ref<PlayerStat[]>([])

  /** Whether stats have been fetched at least once */
  const initialized = ref(false)

  /** Loading state for async operations */
  const loading = ref(false)

  /**
   * Fetch all player stats from Supabase.
   * Safe to call multiple times — skips if already initialized unless forced.
   */
  async function fetchStats(force = false) {
    if (initialized.value && !force) return

    loading.value = true
    const { data, error } = await supabase
      .from('player_stats')
      .select('*')

    if (error) {
      console.error('[usePlayerStatsStore] fetchStats error:', error)
      loading.value = false
      return
    }

    stats.value = data as PlayerStat[]
    initialized.value = true
    loading.value = false
  }

  /**
   * Get a specific stat value for a player.
   * @returns The stat value or 0 if not found.
   */
  function getStat(
    playerId: number,
    key: string
  ): number {
    const stat = stats.value.find(s => s.player_id === playerId)
    if (!stat) return 0
    return (stat as Record<string, number>)[key] ?? 0
  }

  /**
   * Reset store state (useful for testing or logout).
   */
  function reset() {
    stats.value = []
    initialized.value = false
    loading.value = false
  }

  return {
    stats,
    initialized,
    loading,
    fetchStats,
    getStat,
    reset,
  }
})
