// app\composables\event\useEventPlayers.ts

import type { Player, NewPlayer } from '#shared/utils/types'
import type { PlayerUpdatePayload } from '~/composables/players/usePlayerMutations'

interface EventPlayersDeps {
  // Actions from useEventPage
  addToWaitingList: (playerIds: number[]) => Promise<void>
  removeFromWaitingList: (playerIds: number[]) => Promise<void>

  // State
  players: Ref<Player[]>

  // Modal refs
  showCreatePlayerModal: Ref<boolean>
  showPlayerSearchModal: Ref<boolean>
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
    players, showCreatePlayerModal, showPlayerSearchModal, playerToEdit, toast,
  } = deps

  const { t } = useI18n()
  const { createPlayer, updatePlayer } = usePlayerMutations()

  // True only when the create-player modal was opened via PlayerSearchModal's
  // "create new" escape hatch — set here, cleared by every path that closes
  // the modal (success or cancel). Read by the watcher below so *cancelling*
  // (any way: Annulla, backdrop, ESC, X) returns to the search modal instead
  // of just closing everything, while a successful create/update/select
  // doesn't reopen it.
  const openedFromSearch = ref(false)

  function handleCreateNewPlayer() {
    playerToEdit.value = null
    openedFromSearch.value = true
    showCreatePlayerModal.value = true
  }

  function handleEditPlayer(playerId: number) {
    const player = players.value.find(p => p.player_id === playerId)
    if (player) {
      playerToEdit.value = player
      openedFromSearch.value = false
      showCreatePlayerModal.value = true
    }
  }

  watch(showCreatePlayerModal, (isOpen) => {
    if (isOpen || !openedFromSearch.value) return
    openedFromSearch.value = false
    showPlayerSearchModal.value = true
  })

  async function handlePlayerCreate(player: NewPlayer) {
    let created
    try {
      ({ player: created } = await createPlayer.mutateAsync(player))
    } catch (err) {
      toast.add({ title: t('store.player.createError'), description: toErrorMessage(err, t('store.player.createError')), color: 'error' })
      return
    }
    await addToWaitingList([created.player_id])
    openedFromSearch.value = false
    showCreatePlayerModal.value = false
    const display = sanitizePlayer(created)
    toast.add({ title: t('event.playerCreatedTitle'), description: t('event.playerCreatedDescription', { name: `${display.player_name} ${display.player_surname}` }), color: 'success' })
  }

  async function handlePlayerUpdate(payload: PlayerUpdatePayload) {
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
    openedFromSearch.value = false
    showCreatePlayerModal.value = false
    toast.add({ title: t('event.playerAddedTitle'), description: t('event.playerAddedDescription'), color: 'success' })
  }

  function handlePlayerStatusUpdate(payload: { playerId: number, paid: boolean, companion: boolean }) {
    logDebug('useEventPlayers', 'Player status updated:', payload)
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
