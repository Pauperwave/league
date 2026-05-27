import type { Kill } from '#shared/utils/types'

export const useKillsStore = defineStore('kills', () => {
  const kills = ref<Kill[]>([])

  const isKillPresent = computed(() => (killerId: number, victimId: number) =>
    kills.value.some(k => k.killerId === killerId && k.victimId === victimId))

  const isReverseKillPresent = computed(() => (killerId: number, victimId: number) =>
    kills.value.some(k => k.killerId === victimId && k.victimId === killerId))

  const hasSuicided = computed(() => (playerId: number) =>
    kills.value.some(k => k.killerId === playerId && k.victimId === playerId))

  const killsByKiller = computed(() => (killerId: number) =>
    kills.value.filter(k => k.killerId === killerId).map(k => k.victimId))

  const deathsByVictim = computed(() => (victimId: number) =>
    kills.value.filter(k => k.victimId === victimId).length)

  function addKill(killerId: number, victimId: number): { success: boolean; error?: string } {
    if (isKillPresent.value(killerId, victimId))
      return { success: false, error: 'Uccisione già registrata' }

    if (isReverseKillPresent.value(killerId, victimId))
      return { success: false, error: 'La vittima ha già ucciso questo giocatore' }

    kills.value.push({ killerId, victimId })

    return { success: true }
  }

  function removeKill(killerId: number, victimId: number) {
    kills.value = kills.value.filter(
      k => !(k.killerId === killerId && k.victimId === victimId),
    )
  }

  function reset() {
    kills.value = []
  }

  return {
    kills,
    isKillPresent,
    isReverseKillPresent,
    hasSuicided,
    killsByKiller,
    deathsByVictim,
    addKill,
    removeKill,
    reset,
  }
}, {
  persist: {
    storage: piniaPluginPersistedstate.localStorage(),
  },
})
