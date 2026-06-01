// app\stores\votes.ts

/** Entry tracking a player's deck and play votes */
interface VoteEntry {
  playerId: number
  deckVotePlayerId: number | null
  playVotePlayerId: number | null
}

/**
 * Session store for deck and play votes during a round.
 * Manages ephemeral vote data that is reset between rounds.
 */
export const useVotesStore = defineStore('votes', () => {
  /** Map of playerId -> vote entry */
  const votes = ref<Map<number, VoteEntry>>(new Map())

  /** Get the full vote entry for a player */
  const getVotes = computed(() => (playerId: number) => votes.value.get(playerId))

  /** Get the deck vote target for a player */
  const getDeckVote = computed(() => (playerId: number) =>
    votes.value.get(playerId)?.deckVotePlayerId ?? null)

  /** Get the play vote target for a player */
  const getPlayVote = computed(() => (playerId: number) =>
    votes.value.get(playerId)?.playVotePlayerId ?? null)

  /** Check if a player has cast any votes */
  const hasVotes = computed(() => (playerId: number) => {
    const entry = votes.value.get(playerId)
    return !!entry && (entry.deckVotePlayerId !== null || entry.playVotePlayerId !== null)
  })

  /** Set both deck and play votes for a player */
  function setVotes(playerId: number, deckVotePlayerId: number | null, playVotePlayerId: number | null) {
    votes.value.set(playerId, { playerId, deckVotePlayerId, playVotePlayerId })
    votes.value = new Map(votes.value)
  }

  /** Set only the deck vote for a player (preserves existing play vote) */
  function setDeckVote(playerId: number, deckVotePlayerId: number | null) {
    const existing = votes.value.get(playerId)
    if (existing) {
      votes.value.set(playerId, { ...existing, deckVotePlayerId })
    }
    else {
      votes.value.set(playerId, { playerId, deckVotePlayerId, playVotePlayerId: null })
    }
    votes.value = new Map(votes.value)
  }

  /** Set only the play vote for a player (preserves existing deck vote) */
  function setPlayVote(playerId: number, playVotePlayerId: number | null) {
    const existing = votes.value.get(playerId)
    if (existing) {
      votes.value.set(playerId, { ...existing, playVotePlayerId })
    }
    else {
      votes.value.set(playerId, { playerId, deckVotePlayerId: null, playVotePlayerId })
    }
    votes.value = new Map(votes.value)
  }

  /** Remove all votes for a player */
  function removeVotes(playerId: number) {
    votes.value.delete(playerId)
    votes.value = new Map(votes.value)
  }

  /** Clear all votes */
  function reset() {
    votes.value.clear()
    votes.value = new Map()
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
})
