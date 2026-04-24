interface RankingEntry {
  playerId: number
  rank: number
}

interface RankingsState {
  rankingsWithRanks: Map<number, RankingEntry[]> // Ranking salvato con rank effettivi
}

export const useRankingsStore = defineStore('rankings', {
  state: (): RankingsState => ({
    rankingsWithRanks: new Map(),
  }),

  getters: {
    getRankingWithRanks: (state) => (pairingId: number) => state.rankingsWithRanks.get(pairingId),
    hasRanking: (state) => (pairingId: number) => state.rankingsWithRanks.has(pairingId),
  },

  actions: {
    setRankingWithRanks(pairingId: number, ranking: RankingEntry[]) {
      this.rankingsWithRanks.set(pairingId, ranking)
    },

    removeRanking(pairingId: number) {
      this.rankingsWithRanks.delete(pairingId)
    },

    reset() {
      this.rankingsWithRanks.clear()
    },
  },
})
