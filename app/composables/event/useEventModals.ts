// app\composables\event\useEventModals.ts

/**
 * Composable that encapsulates ALL modal visibility and selection state for the event page.
 */
export function useEventModals() {
  // ─── Simple Visibility Flags ────────────────────────────────────────────────

  const showEventEditModal = ref(false)
  const showNextRoundModal = ref(false)
  const showStartPreviewModal = ref(false)
  const showCancelRoundConfirm = ref(false)
  const showEndEventConfirm = ref(false)
  const showKillModal = ref(false)
  const showPlayerSearchModal = ref(false)
  const showCreatePlayerModal = ref(false)
  const showScoresModal = ref(false)

  // ─── Player Editing ─────────────────────────────────────────────────────────

  const playerToEdit = ref<import('#shared/utils/types').Player | null>(null)

  // ─── Score Modal State ──────────────────────────────────────────────────────

  const showScoreModal = ref(false)
  const selectedPairingId = ref<number | null>(null)
  const selectedTableIndex = ref<number | null>(null)

  // ─── Commander Modal State ────────────────────────────────────────────────────

  const showCommanderModal = ref(false)
  const selectedPlayerId = ref<number | null>(null)
  const selectedCommanderPairingId = ref<number | null>(null)
  const commanderModalRef = ref<InstanceType<typeof import('~/components/commander/CommanderModal.vue').default> | null>(null)

  // ─── Scores Modal State ─────────────────────────────────────────────────────

  const selectedScoresPairingId = ref<number | null>(null)

  // ─── Votes Modal State ──────────────────────────────────────────────────────

  const showVotesModal = ref(false)
  const selectedVotesPlayerId = ref<number | null>(null)
  const selectedVotesPairingId = ref<number | null>(null)

  // ─── Kill Modal Selection ─────────────────────────────────────────────────────

  const selectedKillPairingId = ref<number | null>(null)

  return {
    // Simple flags
    showEventEditModal,
    showNextRoundModal,
    showStartPreviewModal,
    showCancelRoundConfirm,
    showEndEventConfirm,
    showKillModal,
    showPlayerSearchModal,
    showCreatePlayerModal,
    showScoresModal,

    // Player editing
    playerToEdit,

    // Score modal
    showScoreModal,
    selectedPairingId,
    selectedTableIndex,

    // Scores modal
    selectedScoresPairingId,

    // Commander modal
    showCommanderModal,
    selectedPlayerId,
    selectedCommanderPairingId,
    commanderModalRef,

    // Votes modal
    showVotesModal,
    selectedVotesPlayerId,
    selectedVotesPairingId,

    // Kill modal
    selectedKillPairingId,
  }
}
