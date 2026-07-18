<!-- app\pages\players\index.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- create-player handler boilerplate shared with useEventPlayers (the post-create flows differ: plain toast here, waitlist registration there)
import type { NewPlayer } from '#shared/utils/types'

const { t } = useI18n()

useSeoMeta({ title: t('player.pageTitle') })

const toast = useToast()

// Colada caches (ADR-015): players list + all decks for the per-player counts
const { data: playersData, isLoading: playersLoading } = usePlayersQuery()
const players = computed(() => playersData.value ?? [])
const { data: decksData } = useDecksQuery()
const { getStat } = useAllPlayerStats()

const { createPlayer } = usePlayerMutations()

const {
  searchQuery, showOnlyWithDecks, sortBy, sortDirection,
  filteredPlayers, emptyState, getSortLabel
} = usePlayersFilter(
  players,
  getStat,
  (id) => (decksData.value ?? []).filter(d => d.player_id === id).length
)

const showCreatePlayerModal = ref(false)

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
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <PlayersHeader @create-player="showCreatePlayerModal = true" />

    <PlayersToolbar
      v-model:search-query="searchQuery"
      v-model:show-only-with-decks="showOnlyWithDecks"
      v-model:sort-by="sortBy"
      v-model:sort-direction="sortDirection"
    />

    <div v-if="playersLoading" class="flex items-center justify-center py-12">
      <UIcon :name="ICONS.loading" class="size-8 animate-spin text-primary" />
    </div>

    <PlayersGrid
      v-else-if="filteredPlayers.length > 0"
      :players="filteredPlayers"
      :sort-by="sortBy"
      :get-sort-label="getSortLabel"
      :get-player-stat="getStat"
    />

    <PlayersEmptyState
      v-else-if="emptyState"
      :type="emptyState"
      :search-query="searchQuery"
      @create-player="showCreatePlayerModal = true"
      @clear-filter="showOnlyWithDecks = false"
    />

    <CreatePlayerModal
      v-model:open="showCreatePlayerModal"
      :player="null"
      :existing-players="players"
      @create="handlePlayerCreate"
    />
  </div>
</template>
