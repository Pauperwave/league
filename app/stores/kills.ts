import type { Kill } from '#shared/utils/types'

interface KillsState {
  kills: Kill[]
}

export const useKillsStore = defineStore('kills', {
  state: (): KillsState => ({
    kills: [],
  }),

  getters: {
    isKillPresent: (state) => (killerId: number, victimId: number) =>
      state.kills.some((k) => k.killerId === killerId && k.victimId === victimId),

    isReverseKillPresent: (state) => (killerId: number, victimId: number) =>
      state.kills.some((k) => k.killerId === victimId && k.victimId === killerId),

    hasSuicided: (state) => (playerId: number) =>
      state.kills.some((k) => k.killerId === playerId && k.victimId === playerId),

    killsByKiller: (state) => (killerId: number) =>
      state.kills.filter((k) => k.killerId === killerId).map((k) => k.victimId),

    deathsByVictim: (state) => (victimId: number) =>
      state.kills.filter((k) => k.victimId === victimId).length,
  },

  actions: {
    addKill(killerId: number, victimId: number): { success: boolean; error?: string } {

      if (this.isKillPresent(killerId, victimId))
        return { success: false, error: 'Uccisione già registrata' }

      if (this.isReverseKillPresent(killerId, victimId))
        return { success: false, error: 'La vittima ha già ucciso questo giocatore' }

      this.kills.push({ killerId, victimId })

      return { success: true }
    },

    removeKill(killerId: number, victimId: number) {
      this.kills = this.kills.filter(
        (k) => !(k.killerId === killerId && k.victimId === victimId),
      )
    },

    reset() {
      this.kills = []
    },
  },
})
