// app\composables\event\useEventPlayers.ts

import type { Player, NewPlayer } from '#shared/utils/types'

interface EventPlayersDeps {
  // Actions from useEventPage
  addToWaitingList: (playerIds: number[]) => Promise<void>
  removeFromWaitingList: (playerId: number) => Promise<void>

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
export function useEventPlayers(deps: EventPlayersDeps) {
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
    showCreatePlayerModal.value = false
    const display = sanitizePlayer(created)
    toast.add({ title: t('event.playerCreatedTitle'), description: t('event.playerCreatedDescription', { name: `${display.player_name} ${display.player_surname}` }), color: 'success' })
  }

  async function handlePlayerUpdate(payload: { id: number, data: NewPlayer }) {
    try {
      await updatePlayer.mutateAsync(payload)
    } catch (err) {
      toast.add({ title: t('store.player.updateError'), description: toErrorMessage(err, t('store.player.updateError')), color: 'error' })
      return
    }
    showCreatePlayerModal.value = false
    toast.add({ title: t('event.playerUpdatedTitle'), color: 'success' })
  }

  async function handlePlayerSelectFromModal(playerId: number) {
    await addToWaitingList([playerId])
    showCreatePlayerModal.value = false
    toast.add({ title: t('event.playerAddedTitle'), description: t('event.playerAddedDescription'), color: 'success' })
  }

  function handlePlayerStatusUpdate(payload: { playerId: number, paid: boolean, companion: boolean }) {
    logDebug('useEventPlayers', 'Player status updated:', payload)
  }

  async function handleBatchRemove(playerIds: number[]) {
    for (const playerId of playerIds) await removeFromWaitingList(playerId)
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
