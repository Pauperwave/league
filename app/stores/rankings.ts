interface RankingEntry {
  playerId: number
  rank: number
}

export const useRankingsStore = defineStore('rankings', () => {
  const rankingsWithRanks = ref<Map<number, RankingEntry[]>>(new Map())

  const getRankingWithRanks = computed(() => (pairingId: number) =>
    rankingsWithRanks.value.get(pairingId))

  const hasRanking = computed(() => (pairingId: number) =>
    rankingsWithRanks.value.has(pairingId))

  function setRankingWithRanks(pairingId: number, ranking: RankingEntry[]) {
    rankingsWithRanks.value.set(pairingId, ranking)
  }

  function removeRanking(pairingId: number) {
    rankingsWithRanks.value.delete(pairingId)
  }

  function reset() {
    rankingsWithRanks.value.clear()
  }

  return {
    rankingsWithRanks,
    getRankingWithRanks,
    hasRanking,
    setRankingWithRanks,
    removeRanking,
    reset,
  }
}, {
  persist: {
    storage: piniaPluginPersistedstate.localStorage(),
  },
})
