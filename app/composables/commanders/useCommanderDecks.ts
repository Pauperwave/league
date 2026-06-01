import type { CommanderDeck } from '#shared/utils/types'

interface RoundResultUsage {
  commander_1: string | null
  commander_2: string | null
}

/**
 * Composable per gestire i commander decks di un giocatore.
 * Fetcha i deck + i round_results per determinare quali sono in uso.
 * SSR-friendly wrapper attorno allo store.
 *
 * @param playerId - Ref reattivo al player_id (può essere undefined inizialmente)
 */
export function useCommanderDecks(playerId: Ref<number | undefined>) {
  const store = useCommanderDeckStore()
  const supabase = useSupabaseClient()

  // Fetch usage data (round_results) via useAsyncData for SSR
  const { data: usageData, pending, error } = useAsyncData<{ usage: RoundResultUsage[] }>(
    () => playerId.value ? `commander-decks-usage-by-player-${playerId.value}` : 'commander-decks-usage-none',
    async () => {
      if (!playerId.value) {
        return { usage: [] }
      }

      // Ensure store has fetched decks for this player
      await store.fetchDecksByPlayer(playerId.value)

      // Fetch round_results for this player to determine deck usage
      const { data: usageRows } = await supabase
        .from('round_results')
        .select('commander_1, commander_2')
        .eq('player_id', playerId.value)

      return {
        usage: usageRows || []
      }
    },
    {
      server: true,
      default: () => ({ usage: [] }),
      watch: [playerId]
    }
  )

  // Decks are read directly from the reactive store — mutations are instant
  const decks = computed(() => {
    if (!playerId.value) return []
    return store.decks.filter(d => d.player_id === playerId.value)
  })

  // Build a usage map: key = "commander1|commander2" → count
  const usageMap = computed(() => {
    const map = new Map<string, number>()
    for (const row of usageData.value?.usage || []) {
      const key = `${row.commander_1 ?? ''}|${row.commander_2 ?? ''}`
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  })

  function getDeckUsageKey(deck: CommanderDeck): string {
    return `${deck.commander_1_name}|${deck.commander_2_name ?? ''}`
  }

  function isDeckInUse(deck: CommanderDeck): boolean {
    return (usageMap.value.get(getDeckUsageKey(deck)) || 0) > 0
  }

  function getDeckEventCount(deck: CommanderDeck): number {
    return usageMap.value.get(getDeckUsageKey(deck)) || 0
  }

  return {
    data: decks,
    pending,
    error,
    isDeckInUse,
    getDeckEventCount,
    refresh: async () => {
      if (playerId.value) {
        const result = await store.fetchDecksByPlayer(playerId.value)
        return result
      }
      return []
    }
  }
}
