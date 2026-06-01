// app\stores\commanders.ts

/** Entry tracking a player's commander cards */
interface CommanderEntry {
  playerId: number
  commander1: string | null
  commander2: string | null
}

/**
 * Session store for commander tracking during a round.
 * Manages ephemeral commander data that is reset between rounds.
 */
export const useCommandersStore = defineStore('commanders', () => {
  /** Map of playerId -> commander entry */
  const commanders = ref<Map<number, CommanderEntry>>(new Map())

  /** Get the full commander entry for a player */
  const getCommanders = computed(() => (playerId: number) => commanders.value.get(playerId))

  /** Get the first commander for a player */
  const getCommander1 = computed(() => (playerId: number) =>
    commanders.value.get(playerId)?.commander1 ?? null)

  /** Get the second commander for a player */
  const getCommander2 = computed(() => (playerId: number) =>
    commanders.value.get(playerId)?.commander2 ?? null)

  /** Set both commanders for a player */
  function setCommanders(playerId: number, commander1: string | null, commander2: string | null) {
    commanders.value.set(playerId, { playerId, commander1, commander2 })
  }

  /** Set only the first commander for a player (preserves existing commander2) */
  function setCommander1(playerId: number, commander1: string | null) {
    const existing = commanders.value.get(playerId)
    if (existing) {
      commanders.value.set(playerId, { ...existing, commander1 })
    }
    else {
      commanders.value.set(playerId, { playerId, commander1, commander2: null })
    }
  }

  /** Set only the second commander for a player (preserves existing commander1) */
  function setCommander2(playerId: number, commander2: string | null) {
    const existing = commanders.value.get(playerId)
    if (existing) {
      commanders.value.set(playerId, { ...existing, commander2 })
    }
    else {
      commanders.value.set(playerId, { playerId, commander1: null, commander2 })
    }
  }

  /** Remove all commanders for a player */
  function removeCommanders(playerId: number) {
    commanders.value.delete(playerId)
  }

  /** Clear all commanders */
  function reset() {
    commanders.value.clear()
  }

  return {
    commanders,
    getCommanders,
    getCommander1,
    getCommander2,
    setCommanders,
    setCommander1,
    setCommander2,
    removeCommanders,
    reset,
  }
})
