interface VoteEntry {
  playerId: number
  deckVotePlayerId: number | null // player ID for deck preference
  playVotePlayerId: number | null // player ID for play quality
}

interface VotesState {
  votes: Map<number, VoteEntry> // playerId -> { deckVotePlayerId, playVotePlayerId }
}

export const useVotesStore = defineStore('votes', {
  state: (): VotesState => ({
    votes: new Map(),
  }),

  getters: {
    getVotes: (state) => (playerId: number) => state.votes.get(playerId),
    getDeckVote: (state) => (playerId: number) => state.votes.get(playerId)?.deckVotePlayerId || null,
    getPlayVote: (state) => (playerId: number) => state.votes.get(playerId)?.playVotePlayerId || null,
    hasVotes: (state) => (playerId: number) => {
      const entry = state.votes.get(playerId)
      return !!entry && (entry.deckVotePlayerId !== null || entry.playVotePlayerId !== null)
    },
  },

  actions: {
    setVotes(playerId: number, deckVotePlayerId: number | null, playVotePlayerId: number | null) {
      this.votes.set(playerId, { playerId, deckVotePlayerId, playVotePlayerId })
    },

    setDeckVote(playerId: number, deckVotePlayerId: number | null) {
      const existing = this.votes.get(playerId)
      if (existing) {
        this.votes.set(playerId, { ...existing, deckVotePlayerId })
      }
      else {
        this.votes.set(playerId, { playerId, deckVotePlayerId, playVotePlayerId: null })
      }
    },

    setPlayVote(playerId: number, playVotePlayerId: number | null) {
      const existing = this.votes.get(playerId)
      if (existing) {
        this.votes.set(playerId, { ...existing, playVotePlayerId })
      }
      else {
        this.votes.set(playerId, { playerId, deckVotePlayerId: null, playVotePlayerId })
      }
    },

    removeVotes(playerId: number) {
      this.votes.delete(playerId)
    },

    reset() {
      this.votes.clear()
    },
  },
})
