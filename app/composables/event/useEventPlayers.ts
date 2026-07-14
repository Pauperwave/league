// app\composables\event\useEventPlayers.ts

import type { Player, NewPlayer } from '#shared/utils/types'

interface EventPlayersDeps {
  // Stores
  playerStore: ReturnType<typeof import('~/stores/players').usePlayerStore>

  // Actions from useEventPage
  addToWaitingList: (playerIds: number[]) => Promise<void>
  removeFromWaitingList: (playerId: number) => Promise<void>

  // State
  players: Ref<import('#shared/utils/types').Player[]>

  // Modal refs
  showCreatePlayerModal: Ref<boolean>
  playerToEdit: Ref<Player | null>

  // Toast
  toast: ReturnType<typeof import('#ui/composables/useToast').useToast>
}

/**
 * Composable for player management actions within an event context.
 */
export function useEventPlayers(deps: EventPlayersDeps) {
  const {
    playerStore, addToWaitingList, removeFromWaitingList,
    players, showCreatePlayerModal, playerToEdit, toast,
  } = deps

  const { t } = useI18n()

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
    const result = await playerStore.createPlayer(player)
    if (result?.success && result.data) {
      await addToWaitingList([result.data.player_id])
      showCreatePlayerModal.value = false
      toast.add({ title: t('event.playerCreatedTitle'), description: t('event.playerCreatedDescription', { name: `${result.data.player_name} ${result.data.player_surname}` }), color: 'success' })
    }
  }

  async function handlePlayerUpdate(payload: { id: number, data: NewPlayer }) {
    const result = await playerStore.updatePlayer(payload.id, payload.data)
    if (result?.success) {
      showCreatePlayerModal.value = false
      toast.add({ title: t('event.playerUpdatedTitle'), color: 'success' })
    }
  }

  async function handlePlayerSelectFromModal(playerId: number) {
    await addToWaitingList([playerId])
    showCreatePlayerModal.value = false
    toast.add({ title: t('event.playerAddedTitle'), description: t('event.playerAddedDescription'), color: 'success' })
  }

  function handlePlayerStatusUpdate(payload: { playerId: number, paid: boolean, companion: boolean }) {
    console.log('Player status updated:', payload)
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
