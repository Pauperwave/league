interface CommanderEntry {
  playerId: number
  commander1: string | null
  commander2: string | null
}

interface CommandersState {
  commanders: Map<number, CommanderEntry> // playerId -> { commander1, commander2 }
}

export const useCommandersStore = defineStore('commanders', {
  state: (): CommandersState => ({
    commanders: new Map(),
  }),

  getters: {
    getCommanders: (state) => (playerId: number) => state.commanders.get(playerId),
    getCommander1: (state) => (playerId: number) => state.commanders.get(playerId)?.commander1 || null,
    getCommander2: (state) => (playerId: number) => state.commanders.get(playerId)?.commander2 || null,
  },

  actions: {
    setCommanders(playerId: number, commander1: string | null, commander2: string | null) {
      this.commanders.set(playerId, { playerId, commander1, commander2 })
    },

    setCommander1(playerId: number, commander1: string | null) {
      const existing = this.commanders.get(playerId)
      if (existing) {
        this.commanders.set(playerId, { ...existing, commander1 })
      }
      else {
        this.commanders.set(playerId, { playerId, commander1, commander2: null })
      }
    },

    setCommander2(playerId: number, commander2: string | null) {
      const existing = this.commanders.get(playerId)
      if (existing) {
        this.commanders.set(playerId, { ...existing, commander2 })
      }
      else {
        this.commanders.set(playerId, { playerId, commander1: null, commander2 })
      }
    },

    removeCommanders(playerId: number) {
      this.commanders.delete(playerId)
    },

    reset() {
      this.commanders.clear()
    },
  },
})
