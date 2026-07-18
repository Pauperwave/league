// app\composables\commanders\useCommanderDecks.ts
import type { CommanderDeck } from '#shared/utils/types'

interface RoundResultUsage {
  commander_1: string | null
  commander_2: string | null
}

/** Query-key prefix for per-player deck usage — invalidated by useDeckMutations. */
export const DECK_USAGE_KEY = ['deck-usage']

/**
 * A player's commander decks plus their event usage (ADR-015): decks derive
 * from the cached ['decks'] Colada query, usage from a per-player
 * ['deck-usage', id] query over round_results (which decks were played, for
 * the UI's in-use badge/guard).
 *
 * @param playerId - Reactive ref to the player_id (may be undefined initially)
 */
export function useCommanderDecks(playerId: Ref<number | undefined>) {
  const supabase = useSupabaseClient()

  const { decks, isLoading: decksLoading, error } = usePlayerDecks(playerId)

  const { data: usageData, isLoading: usageLoading } = useQuery({
    key: () => [...DECK_USAGE_KEY, playerId.value ?? 0],
    query: async (): Promise<RoundResultUsage[]> => {
      if (!playerId.value) return []

      const { data, error: usageError } = await supabase
        .from('round_results')
        .select('commander_1, commander_2')
        .eq('player_id', playerId.value)

      if (usageError) throw usageError
      return data ?? []
    },
  })

  const pending = computed(() => decksLoading.value || usageLoading.value)

  // Build a usage map: key = "commander1|commander2" → count
  const usageMap = computed(() => {
    const map = new Map<string, number>()
    for (const row of usageData.value ?? []) {
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
    getDeckEventCount
  }
}
