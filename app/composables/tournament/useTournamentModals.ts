// app\composables\tournament\useTournamentModals.ts

/**
 * Composable that encapsulates ALL modal visibility and selection state for the event page.
 */
export function useTournamentModals() {
  // ─── Simple Visibility Flags ────────────────────────────────────────────────

  const showTournamentEditModal = ref(false)
  const showNextRoundModal = ref(false)
  const showStartPreviewModal = ref(false)
  const showCancelRoundConfirm = ref(false)
  const showEndTournamentConfirm = ref(false)
  const showKillModal = ref(false)
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
    showTournamentEditModal,
    showNextRoundModal,
    showStartPreviewModal,
    showCancelRoundConfirm,
    showEndTournamentConfirm,
    showKillModal,
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

    // Votes modal
    showVotesModal,
    selectedVotesPlayerId,
    selectedVotesPairingId,

    // Kill modal
    selectedKillPairingId,
  }
}
