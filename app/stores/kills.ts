// app\stores\kills.ts
import type { Kill } from '#shared/utils/types'

/**
 * Store for tracking player kills during an event round.
 * Manages ephemeral kill data and pairing confirmation state.
 */
export const useKillsStore = defineStore('kills', () => {
  const { t } = useI18n()

  // ── State ──────────────────────────────────────────────────────────────────

  /** All kills registered in the current round */
  const kills = ref<Kill[]>([])

  // ── Getters ────────────────────────────────────────────────────────────────

  /** Check if a specific kill (killer → victim) already exists */
  const isKillPresent = computed(() => (killerId: number, victimId: number) =>
    kills.value.some(k => k.killerId === killerId && k.victimId === victimId))

  /** Check if the reverse kill (victim → killer) already exists */
  const isReverseKillPresent = computed(() => (killerId: number, victimId: number) =>
    kills.value.some(k => k.killerId === victimId && k.victimId === killerId))

  /** Check if a player has killed themselves */
  const hasSuicided = computed(() => (playerId: number) =>
    kills.value.some(k => k.killerId === playerId && k.victimId === playerId))

  /** Get all victim IDs for a given killer */
  const killsByKiller = computed(() => (killerId: number) =>
    kills.value.filter(k => k.killerId === killerId).map(k => k.victimId))

  /** Get the number of deaths for a given victim */
  const deathsByVictim = computed(() => (victimId: number) =>
    kills.value.filter(k => k.victimId === victimId).length)

  /** Check if a pairing's kills have been confirmed */
  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Add a kill after validating no duplicate or reverse exists.
   * @returns Object indicating success or an error message
   */
  function addKill(killerId: number, victimId: number): { success: boolean; error?: string } {
    if (isKillPresent.value(killerId, victimId))
      return { success: false, error: t('store.kill.alreadyRegistered') }

    if (isReverseKillPresent.value(killerId, victimId))
      return { success: false, error: t('store.kill.victimAlreadyKilled') }

    kills.value.push({ killerId, victimId })

    return { success: true }
  }

  /** Remove a specific kill */
  function removeKill(killerId: number, victimId: number) {
    kills.value = kills.value.filter(
      k => !(k.killerId === killerId && k.victimId === victimId),
    )
  }

  /**
   * Replace all state from an external snapshot (localStorage today, a
   * realtime subscription in the future) — the single rehydration entry point.
   */
  function hydrate(snapshot: { kills: Kill[] }) {
    kills.value = [...snapshot.kills]
  }

  /** Clear all kills */
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
    hydrate,
    reset,
  }
})
