// app\composables\tournament\useTournamentLifecycle.ts
import type { TournamentUpdatePayload } from '~/components/tournament/modal/TournamentFormModal.vue'
import type { PaymentMethod } from '~/composables/tournament/useWaitingListFlags'

interface LifecycleDeps {
  // Tournament actions from useTournamentPage
  tournamentId: number
  nextRound: (playerOrder?: number[]) => Promise<boolean>
  turnBackRound: () => Promise<boolean>
  startTournament: (playerOrder: number[], payments?: { playerId: number; paymentMethod: PaymentMethod }[]) => Promise<boolean>
  updateTournament: (payload: TournamentUpdatePayload) => Promise<boolean>

  // State refs
  showNextRoundModal: Ref<boolean>
  showEndTournamentConfirm: Ref<boolean>
  showStartPreviewModal: Ref<boolean>
  showCancelRoundConfirm: Ref<boolean>
  showTournamentEditModal: Ref<boolean>

  // Computed state
  isLastRound: ComputedRef<boolean>
  currentRound: ComputedRef<number>
  tournamentStatus: ComputedRef<'registration' | 'playing' | 'ended'>

  // URL sync
  syncUrl: (phase: 'registration' | 'playing' | 'ended', round: number) => void

  // Viewed-round state (TODO #12): must be cleared on every lifecycle
  // transition, or a stale viewedRound survives a turn-back and ends up
  // querying a round number that no longer means what it used to.
  clearViewedRound: () => void

  // Session stores
  killsStore: ReturnType<typeof import('~/stores/kills').useKillsStore>
  rankingsStore: ReturnType<typeof import('~/stores/rankings').useRankingsStore>
  commandersStore: ReturnType<typeof import('~/stores/commanders').useCommandersStore>
  votesStore: ReturnType<typeof import('~/stores/votes').useVotesStore>
}

/**
 * Composable for tournament lifecycle actions (next round, end tournament, cancel round, etc.)
 */
export function useTournamentLifecycle(deps: LifecycleDeps) {
  const {
    tournamentId, nextRound, turnBackRound, startTournament, updateTournament,
    showNextRoundModal, showEndTournamentConfirm, showStartPreviewModal, showCancelRoundConfirm, showTournamentEditModal,
    isLastRound, currentRound, tournamentStatus,
    syncUrl, clearViewedRound,
    killsStore, rankingsStore, commandersStore, votesStore,
  } = deps

  // Every lifecycle transition (advance/end/turn-back) forces the view back
  // to "current round" — only an explicit stepper click may leave it again.
  function resetSessionStores() {
    killsStore.reset()
    rankingsStore.reset()
    commandersStore.reset()
    votesStore.reset()
    clearViewedRound()
  }

  /**
   * NextRoundModal confirm: hand over to the table preview, which runs the
   * optimizer and supplies the confirmed playerOrder that the advance-round
   * endpoint requires — never call nextRound() directly from here (the
   * endpoint rejects a missing playerOrder unless the tournament is ending).
   */
  function confirmNextRound() {
    showNextRoundModal.value = false
    showStartPreviewModal.value = true
  }

  async function confirmEndEvent() {
    showEndTournamentConfirm.value = false
    const ok = await nextRound()
    if (ok) resetSessionStores()
  }

  async function handlePreviewConfirm(playerOrder: number[]) {
    if (tournamentStatus.value === 'registration') {
      // Snapshot payment methods before startTournament persists them
      // server-side and clearWaitingListFlags wipes localStorage below.
      const flags = readWaitingListFlags(tournamentId)
      const payments = Object.entries(flags)
        .filter((entry): entry is [string, { paymentMethod: PaymentMethod }] => entry[1].paymentMethod !== null)
        .map(([playerId, flag]) => ({ playerId: Number(playerId), paymentMethod: flag.paymentMethod }))

      const ok = await startTournament(playerOrder, payments)
      if (ok) {
        clearWaitingListFlags(tournamentId)
        showStartPreviewModal.value = false
      }
    } else {
      const ok = await nextRound(playerOrder)
      if (ok) {
        resetSessionStores()
        showStartPreviewModal.value = false
      }
    }
  }

  function handleAdvance() {
    if (isLastRound.value) {
      showEndTournamentConfirm.value = true
      return
    }
    // Confirmation first (NextRoundModal), then the table preview.
    showNextRoundModal.value = true
  }

  async function handleUpdateEvent(payload: Parameters<typeof updateTournament>[0]) {
    const ok = await updateTournament(payload)
    if (ok) showTournamentEditModal.value = false
  }

  /**
   * "Annulla Round" resets the current round's data (server-side: deletes
   * this round's pairings/round_results/round_kills, decrements
   * event_current_round — see turn-back-round.post.ts) and lands the admin
   * straight back in the table preview instead of leaving them staring at
   * the reopened previous round's already-played data with no obvious next
   * step. Reuses the same showStartPreviewModal flow as "Prossimo Round" —
   * confirming it re-advances (or re-starts, from round 1) with freshly
   * regenerated pairings.
   */
  async function confirmCancelRound() {
    showCancelRoundConfirm.value = false
    const ok = await turnBackRound()
    if (ok) {
      resetSessionStores()
      showStartPreviewModal.value = true
    }
  }

  function handleCancelRound() {
    showCancelRoundConfirm.value = true
  }

  function handleStepChanged(step: string) {
    if (step === 'registration') syncUrl('registration', currentRound.value)
    else if (step === 'ended') syncUrl('ended', currentRound.value)
    else if (step.startsWith('round-')) syncUrl('playing', parseInt(step.replace('round-', '')))
  }

  return {
    confirmNextRound,
    confirmEndEvent,
    handlePreviewConfirm,
    handleAdvance,
    handleUpdateEvent,
    confirmCancelRound,
    handleCancelRound,
    handleStepChanged,
    resetSessionStores,
  }
}
