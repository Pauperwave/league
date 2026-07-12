// app\stores\kills.ts
import { useI18n } from 'vue-i18n'
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
  /** Set of pairing IDs whose kills have been confirmed/submitted */
  const confirmedPairings = ref<Set<number>>(new Set())

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
  const isPairingConfirmed = computed(() => (pairingId: number) =>
    confirmedPairings.value.has(pairingId))

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

  /** Mark a pairing's kills as confirmed */
  function confirmPairing(pairingId: number) {
    confirmedPairings.value.add(pairingId)
    confirmedPairings.value = new Set(confirmedPairings.value)
  }

  /** Unconfirm a pairing's kills */
  function unconfirmPairing(pairingId: number) {
    confirmedPairings.value.delete(pairingId)
    confirmedPairings.value = new Set(confirmedPairings.value)
  }

  /** Clear all kills and confirmed pairings */
  function reset() {
    kills.value = []
    confirmedPairings.value = new Set()
  }

  return {
    kills,
    confirmedPairings,
    isKillPresent,
    isReverseKillPresent,
    hasSuicided,
    killsByKiller,
    deathsByVictim,
    isPairingConfirmed,
    addKill,
    removeKill,
    confirmPairing,
    unconfirmPairing,
    reset,
  }
})
