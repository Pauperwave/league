interface VoteEntry {
  playerId: number
  deckVotePlayerId: number | null
  playVotePlayerId: number | null
}

export const useVotesStore = defineStore('votes', () => {
  const votes = ref<Map<number, VoteEntry>>(new Map())

  const getVotes = computed(() => (playerId: number) => votes.value.get(playerId))

  const getDeckVote = computed(() => (playerId: number) =>
    votes.value.get(playerId)?.deckVotePlayerId ?? null)

  const getPlayVote = computed(() => (playerId: number) =>
    votes.value.get(playerId)?.playVotePlayerId ?? null)

  const hasVotes = computed(() => (playerId: number) => {
    const entry = votes.value.get(playerId)
    return !!entry && (entry.deckVotePlayerId !== null || entry.playVotePlayerId !== null)
  })

  function setVotes(playerId: number, deckVotePlayerId: number | null, playVotePlayerId: number | null) {
    votes.value.set(playerId, { playerId, deckVotePlayerId, playVotePlayerId })
  }

  function setDeckVote(playerId: number, deckVotePlayerId: number | null) {
    const existing = votes.value.get(playerId)
    if (existing) {
      votes.value.set(playerId, { ...existing, deckVotePlayerId })
    }
    else {
      votes.value.set(playerId, { playerId, deckVotePlayerId, playVotePlayerId: null })
    }
  }

  function setPlayVote(playerId: number, playVotePlayerId: number | null) {
    const existing = votes.value.get(playerId)
    if (existing) {
      votes.value.set(playerId, { ...existing, playVotePlayerId })
    }
    else {
      votes.value.set(playerId, { playerId, deckVotePlayerId: null, playVotePlayerId })
    }
  }

  function removeVotes(playerId: number) {
    votes.value.delete(playerId)
  }

  function reset() {
    votes.value.clear()
  }

  return {
    votes,
    getVotes,
    getDeckVote,
    getPlayVote,
    hasVotes,
    setVotes,
    setDeckVote,
    setPlayVote,
    removeVotes,
    reset,
  }
}, {
  persist: {
    storage: piniaPluginPersistedstate.localStorage(),
  },
})
