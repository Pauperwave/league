<!-- app\pages\players\index.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- create/update-player handler boilerplate shared with useEventPlayers (the post-create/update flows differ: plain toast here, waitlist registration there)
import type { NewPlayer, Player } from '#shared/utils/types'
import type { PlayerUpdatePayload } from '~/composables/players/usePlayerMutations'

const { t } = useI18n()

useSeoMeta({ title: t('player.pageTitle') })

const toast = useToast()

// Colada caches (ADR-015): players list + all decks for the per-player counts
const { data: playersData, isLoading: playersLoading } = usePlayersQuery()
const players = computed(() => playersData.value ?? [])
const { data: decksData } = useDecksQuery()
const { getStat } = useAllPlayerStats()

const { createPlayer, updatePlayer } = usePlayerMutations()

const {
  searchQuery, showOnlyWithDecks, showOnlyActive,
  filteredPlayers, emptyState
} = usePlayersFilter(
  players,
  (id) => (decksData.value ?? []).filter(d => d.player_id === id).length
)

const showCreatePlayerModal = ref(false)
const playerToEdit = ref<Player | null>(null)
const rowSelection = ref<Record<string, boolean>>({})

function openCreateModal() {
  playerToEdit.value = null
  showCreatePlayerModal.value = true
}

function openEditModal(player: Player) {
  playerToEdit.value = player
  showCreatePlayerModal.value = true
}

async function handlePlayerCreate(player: NewPlayer) {
  let created
  try {
    ({ player: created } = await createPlayer.mutateAsync(player))
  } catch (err) {
    toast.add({
      title: t('store.player.createError'),
      description: toErrorMessage(err, t('store.player.createError')),
      color: 'error'
    })
    return
  }
  showCreatePlayerModal.value = false
  const display = sanitizePlayer(created)
  toast.add({
    title: t('player.toast.createdTitle'),
    description: t('player.toast.createdDescription', { name: `${display.player_name} ${display.player_surname}` }),
    color: 'success'
  })
}

async function handlePlayerUpdate(payload: PlayerUpdatePayload) {
  try {
    await updatePlayer.mutateAsync(payload)
  } catch (err) {
    toast.add({
      title: t('store.player.updateError'),
      description: toErrorMessage(err, t('store.player.updateError')),
      color: 'error'
    })
    return
  }
  showCreatePlayerModal.value = false
  toast.add({ title: t('player.toast.updatedTitle'), color: 'success' })
}
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <PlayersHeader @create-player="openCreateModal" />

    <PlayersToolbar
      v-model:search-query="searchQuery"
      v-model:show-only-with-decks="showOnlyWithDecks"
      v-model:show-only-active="showOnlyActive"
    />

    <div v-if="playersLoading" class="flex items-center justify-center py-12">
      <UIcon :name="ICONS.loading" class="size-8 animate-spin text-primary" />
    </div>

    <PlayersTable
      v-else-if="filteredPlayers.length > 0"
      v-model:row-selection="rowSelection"
      :players="filteredPlayers"
      :get-player-stat="getStat"
      :get-deck-count="(id) => (decksData ?? []).filter(d => d.player_id === id).length"
      @edit="openEditModal"
    />

    <PlayersEmptyState
      v-else-if="emptyState"
      :type="emptyState"
      :search-query="searchQuery"
      @create-player="openCreateModal"
      @clear-filter="() => { showOnlyWithDecks = false; showOnlyActive = false }"
    />

    <CreatePlayerModal
      v-model:open="showCreatePlayerModal"
      :player="playerToEdit"
      :existing-players="players"
      context="players"
      @create="handlePlayerCreate"
      @update="handlePlayerUpdate"
      @search="(query) => { searchQuery = query }"
    />
  </div>
</template>
