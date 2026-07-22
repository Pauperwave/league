// app\composables\event\useEventLifecycle.ts
import type { EventUpdatePayload } from '~/components/event/modal/EventFormModal.vue'

interface LifecycleDeps {
  // Event actions from useEventPage
  eventId: number
  nextRound: (playerOrder?: number[]) => Promise<boolean>
  turnBackRound: () => Promise<boolean>
  startEvent: (playerOrder: number[]) => Promise<boolean>
  updateEvent: (payload: EventUpdatePayload) => Promise<boolean>

  // State refs
  showNextRoundModal: Ref<boolean>
  showEndEventConfirm: Ref<boolean>
  showStartPreviewModal: Ref<boolean>
  showCancelRoundConfirm: Ref<boolean>
  showEventEditModal: Ref<boolean>

  // Computed state
  isLastRound: ComputedRef<boolean>
  currentRound: ComputedRef<number>
  eventStatus: ComputedRef<'registration' | 'playing' | 'ended'>

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
 * Composable for event lifecycle actions (next round, end event, cancel round, etc.)
 */
export function useEventLifecycle(deps: LifecycleDeps) {
  const {
    eventId, nextRound, turnBackRound, startEvent, updateEvent,
    showNextRoundModal, showEndEventConfirm, showStartPreviewModal, showCancelRoundConfirm, showEventEditModal,
    isLastRound, currentRound, eventStatus,
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
   * endpoint rejects a missing playerOrder unless the event is ending).
   */
  function confirmNextRound() {
    showNextRoundModal.value = false
    showStartPreviewModal.value = true
  }

  async function confirmEndEvent() {
    showEndEventConfirm.value = false
    const ok = await nextRound()
    if (ok) resetSessionStores()
  }

  async function handlePreviewConfirm(playerOrder: number[]) {
    if (eventStatus.value === 'registration') {
      const ok = await startEvent(playerOrder)
      if (ok) {
        clearWaitingListFlags(eventId)
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
      showEndEventConfirm.value = true
      return
    }
    // Confirmation first (NextRoundModal), then the table preview.
    showNextRoundModal.value = true
  }

  async function handleUpdateEvent(payload: Parameters<typeof updateEvent>[0]) {
    const ok = await updateEvent(payload)
    if (ok) showEventEditModal.value = false
  }

  async function confirmCancelRound() {
    showCancelRoundConfirm.value = false
    const ok = await turnBackRound()
    if (ok) resetSessionStores()
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
