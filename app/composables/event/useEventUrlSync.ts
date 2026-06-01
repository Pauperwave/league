// app\composables\event\useEventUrlSync.ts
import { getPairingPlayerIds } from '#shared/utils/types'

interface EventUrlSyncDeps {
  // URL helpers from useEventUrl
  syncPreview: (isOpen: boolean) => void
  syncScoreModal: (isOpen: boolean, pairingId: number | null) => void
  syncKillModal: (isOpen: boolean, tableId: number | null) => void
  syncVotesModal: (isOpen: boolean, playerId: number | null) => void
  syncCommanderModal: (isOpen: boolean, playerId: number | null) => void
  previewFromQuery: ComputedRef<boolean>
  scoreModalFromQuery: ComputedRef<number | null>
  killModalFromQuery: ComputedRef<number | null>
  votesModalFromQuery: ComputedRef<number | null>
  commanderModalFromQuery: ComputedRef<number | null>

  // Modal refs
  showStartPreviewModal: Ref<boolean>
  showScoreModal: Ref<boolean>
  selectedPairingId: Ref<number | null>
  selectedTableIndex: Ref<number | null>
  pairings: Ref<import('#shared/utils/types').PairingWithResults[]>
  showVotesModal: Ref<boolean>
  selectedVotesPlayerId: Ref<number | null>
  selectedVotesPairingId: Ref<number | null>
  showCommanderModal: Ref<boolean>
  selectedPlayerId: Ref<number | null>
  selectedCommanderPairingId: Ref<number | null>
  showKillModal: Ref<boolean>
  selectedKillPairingId: Ref<number | null>
}

/**
 * Composable that groups all URL query-param ↔ modal sync watchers.
 * Call once in the event page to wire everything up.
 */
export function useEventUrlSync(deps: EventUrlSyncDeps) {
  const {
    syncPreview, syncScoreModal, syncKillModal, syncVotesModal, syncCommanderModal,
    previewFromQuery, scoreModalFromQuery, killModalFromQuery, votesModalFromQuery, commanderModalFromQuery,
    showStartPreviewModal, showScoreModal, selectedPairingId, selectedTableIndex, pairings,
    showVotesModal, selectedVotesPlayerId, selectedVotesPairingId,
    showCommanderModal, selectedPlayerId, selectedCommanderPairingId,
    showKillModal, selectedKillPairingId,
  } = deps

  // ─── Preview Modal ──────────────────────────────────────────────────────────

  watch(showStartPreviewModal, (isOpen) => syncPreview(isOpen))
  watch(previewFromQuery, (isPreview) => { if (isPreview) showStartPreviewModal.value = true })

  // ─── Score Modal ────────────────────────────────────────────────────────────

  watch(showScoreModal, (isOpen) => {
    if (isOpen) syncScoreModal(true, selectedPairingId.value)
    else syncScoreModal(false, null)
  })
  watch(scoreModalFromQuery, (pairingId) => {
    if (pairingId !== null && !showScoreModal.value) {
      const pairing = pairings.value.find(p => p.pairing_id === pairingId)
      if (pairing) {
        selectedPairingId.value = pairingId
        selectedTableIndex.value = pairings.value.indexOf(pairing)
        showScoreModal.value = true
      }
    }
  })

  // ─── Votes Modal ────────────────────────────────────────────────────────────

  watch(showVotesModal, (isOpen) => {
    if (isOpen) syncVotesModal(true, selectedVotesPlayerId.value)
    else syncVotesModal(false, null)
  })
  watch(votesModalFromQuery, (playerId) => {
    if (playerId !== null && !showVotesModal.value) {
      selectedVotesPlayerId.value = playerId
      const pairing = pairings.value.find(p => getPairingPlayerIds(p).includes(playerId))
      if (pairing) selectedVotesPairingId.value = pairing.pairing_id
      showVotesModal.value = true
    }
  })

  // ─── Commander Modal ──────────────────────────────────────────────────────────

  watch(showCommanderModal, (isOpen) => {
    if (isOpen) syncCommanderModal(true, selectedPlayerId.value)
    else syncCommanderModal(false, null)
  })
  watch(commanderModalFromQuery, (playerId) => {
    if (playerId !== null && !showCommanderModal.value) {
      selectedPlayerId.value = playerId
      const pairing = pairings.value.find(p => getPairingPlayerIds(p).includes(playerId))
      if (pairing) selectedCommanderPairingId.value = pairing.pairing_id
      showCommanderModal.value = true
    }
  })

  // ─── Kill Modal ─────────────────────────────────────────────────────────────

  watch(showKillModal, (isOpen) => {
    if (isOpen) syncKillModal(true, selectedKillPairingId.value)
    else syncKillModal(false, null)
  })
  watch(killModalFromQuery, (tableId) => {
    if (tableId !== null && !showKillModal.value) {
      selectedKillPairingId.value = tableId
      showKillModal.value = true
    }
  })
}
