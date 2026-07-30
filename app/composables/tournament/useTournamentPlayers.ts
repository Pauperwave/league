// app\composables\tournament\useTournamentPlayers.ts

import type { Player, NewPlayer } from '#shared/utils/types'
import type { PlayerUpdatePayload } from '~/composables/players/usePlayerMutations'

interface EventPlayersDeps {
  // Actions from useTournamentPage
  addToWaitingList: (playerIds: number[]) => Promise<void>
  removeFromWaitingList: (playerIds: number[]) => Promise<void>

  // State
  players: Ref<Player[]>

  // Modal refs
  showCreatePlayerModal: Ref<boolean>
  playerToEdit: Ref<Player | null>

  // Toast
  toast: ReturnType<typeof import('#ui/composables/useToast').useToast>
}

/**
 * Composable for player management actions within an event context.
 * Player create/update go through the Colada mutations (ADR-015).
 */
export function useTournamentPlayers(deps: EventPlayersDeps) {
  const {
    addToWaitingList, removeFromWaitingList,
    players, showCreatePlayerModal, playerToEdit, toast,
  } = deps

  const { t } = useI18n()
  const { createPlayer, updatePlayer } = usePlayerMutations()

  function handleCreateNewPlayer() {
    playerToEdit.value = null
    showCreatePlayerModal.value = true
  }

  function handleEditPlayer(playerId: number) {
    const player = players.value.find(p => p.player_id === playerId)
    if (player) {
      playerToEdit.value = player
      showCreatePlayerModal.value = true
    }
  }

  async function handlePlayerCreate(player: NewPlayer) {
    let created
    try {
      ({ player: created } = await createPlayer.mutateAsync(player))
    } catch (err) {
      toast.add({ title: t('store.player.createError'), description: toErrorMessage(err, t('store.player.createError')), color: 'error' })
      return
    }
    await addToWaitingList([created.player_id])
    const display = sanitizePlayer(created)
    toast.add({ title: t('tournament.playerCreatedTitle'), description: t('tournament.playerCreatedDescription', { name: `${display.player_name} ${display.player_surname}` }), color: 'success' })
  }

  async function handlePlayerUpdate(payload: PlayerUpdatePayload) {
    try {
      await updatePlayer.mutateAsync(payload)
    } catch (err) {
      toast.add({ title: t('store.player.updateError'), description: toErrorMessage(err, t('store.player.updateError')), color: 'error' })
      return
    }
    showCreatePlayerModal.value = false
    toast.add({ title: t('tournament.playerUpdatedTitle'), color: 'success' })
  }

  async function handlePlayerSelectFromModal(playerId: number) {
    await addToWaitingList([playerId])
    toast.add({ title: t('tournament.playerAddedTitle'), description: t('tournament.playerAddedDescription'), color: 'success' })
  }

  function handlePlayerStatusUpdate(payload: { playerId: number, paid: boolean }) {
    logDebug('useTournamentPlayers', 'Player status updated:', payload)
  }

  async function handleBatchRemove(playerIds: number[]) {
    await removeFromWaitingList(playerIds)
  }

  return {
    handleCreateNewPlayer,
    handleEditPlayer,
    handlePlayerCreate,
    handlePlayerUpdate,
    handlePlayerSelectFromModal,
    handlePlayerStatusUpdate,
    handleBatchRemove,
  }
}
