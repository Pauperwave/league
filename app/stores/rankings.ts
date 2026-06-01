// app\stores\rankings.ts

/** Entry representing a player's rank within a pairing */
interface RankingEntry {
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
    rankingsWithRanks.value = new Map(rankingsWithRanks.value)
  }

  /** Remove the ranking for a pairing */
  function removeRanking(pairingId: number) {
    rankingsWithRanks.value.delete(pairingId)
    rankingsWithRanks.value = new Map(rankingsWithRanks.value)
  }

  /** Clear all rankings */
  function reset() {
    rankingsWithRanks.value.clear()
    rankingsWithRanks.value = new Map()
  }

  return {
    rankingsWithRanks,
    getRankingWithRanks,
    hasRanking,
    setRankingWithRanks,
    removeRanking,
    reset,
  }
})
