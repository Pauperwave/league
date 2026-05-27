interface CommanderEntry {
  playerId: number
  commander1: string | null
  commander2: string | null
}

export const useCommandersStore = defineStore('commanders', () => {
  const commanders = ref<Map<number, CommanderEntry>>(new Map())

  const getCommanders = computed(() => (playerId: number) => commanders.value.get(playerId))

  const getCommander1 = computed(() => (playerId: number) =>
    commanders.value.get(playerId)?.commander1 ?? null)

  const getCommander2 = computed(() => (playerId: number) =>
    commanders.value.get(playerId)?.commander2 ?? null)

  function setCommanders(playerId: number, commander1: string | null, commander2: string | null) {
    commanders.value.set(playerId, { playerId, commander1, commander2 })
  }

  function setCommander1(playerId: number, commander1: string | null) {
    const existing = commanders.value.get(playerId)
    if (existing) {
      commanders.value.set(playerId, { ...existing, commander1 })
    }
    else {
      commanders.value.set(playerId, { playerId, commander1, commander2: null })
    }
  }

  function setCommander2(playerId: number, commander2: string | null) {
    const existing = commanders.value.get(playerId)
    if (existing) {
      commanders.value.set(playerId, { ...existing, commander2 })
    }
    else {
      commanders.value.set(playerId, { playerId, commander1: null, commander2 })
    }
  }

  function removeCommanders(playerId: number) {
    commanders.value.delete(playerId)
  }

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
