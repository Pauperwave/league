// app\stores\rankings.ts

/** Entry representing a player's rank within a pairing */
export interface RankingEntry {
  playerId: number
  rank: number
}

/**
 * Session store for player ranking order per pairing (used in the score modal).
 * Manages ephemeral ranking data that is reset between rounds.
 */
export const useRankingsStore = defineStore('rankings', () => {
  /** Map of pairingId -> array of ranking entries */
  const rankingsWithRanks = ref<Map<number, RankingEntry[]>>(new Map())

  /** Get the ranking entries for a specific pairing */
  const getRankingWithRanks = computed(() => (pairingId: number) =>
    rankingsWithRanks.value.get(pairingId))

  /** Check if a ranking exists for a pairing */
  const hasRanking = computed(() => (pairingId: number) =>
    rankingsWithRanks.value.has(pairingId))

  /** Set or update the ranking for a pairing */
  function setRankingWithRanks(pairingId: number, ranking: RankingEntry[]) {
    rankingsWithRanks.value.set(pairingId, ranking)
  }

  /** Remove the ranking for a pairing */
  function removeRanking(pairingId: number) {
    rankingsWithRanks.value.delete(pairingId)
  }

  /**
   * Replace all state from an external snapshot (localStorage today, a
   * realtime subscription in the future) — the single rehydration entry point.
   */
  function hydrate(entries: [number, RankingEntry[]][]) {
    rankingsWithRanks.value = new Map(entries)
  }

  /** Clear all rankings */
  function reset() {
    rankingsWithRanks.value.clear()
  }

  return {
    rankingsWithRanks,
    getRankingWithRanks,
    hasRanking,
    setRankingWithRanks,
    removeRanking,
    hydrate,
    reset,
  }
})
