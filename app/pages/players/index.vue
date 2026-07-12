<!-- app/pages/players/index.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import type { NewPlayer } from '#shared/utils/types'

const { t } = useI18n()

useSeoMeta({ title: t('player.pageTitle') })

const playersStore = usePlayerStore()
const decksStore = useCommanderDeckStore()
const statsStore = usePlayerStatsStore()
const toast = useToast()

const {
  searchQuery, showOnlyWithDecks, sortBy, sortDirection,
  filteredPlayers, emptyState, getSortLabel
} = usePlayersFilter(
  computed(() => playersStore.players),
  statsStore.getStat,
  (id) => decksStore.getDecksByPlayerId(id).length
)

const showCreatePlayerModal = ref(false)

async function handlePlayerCreate(player: NewPlayer) {
  const result = await playersStore.createPlayer(player)
  if (result?.success && result.data) {
    showCreatePlayerModal.value = false
    toast.add({
      title: t('player.toast.createdTitle'),
      description: t('player.toast.createdDescription', { name: `${result.data.player_name} ${result.data.player_surname}` }),
      color: 'success'
    })
  }
}

onMounted(() => {
  if (playersStore.players.length === 0) playersStore.fetchPlayers()
  if (!decksStore.initialized) decksStore.fetchDecks()
  if (!statsStore.initialized) statsStore.fetchStats()
})
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

    <div v-if="playersStore.loading" class="flex items-center justify-center py-12">
      <UIcon :name="ICONS.loading" class="size-8 animate-spin text-primary" />
    </div>

    <PlayersGrid
      v-else-if="filteredPlayers.length > 0"
      :players="filteredPlayers"
      :sort-by="sortBy"
      :get-sort-label="getSortLabel"
      :get-player-stat="statsStore.getStat"
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
      :existing-players="playersStore.players"
      @create="handlePlayerCreate"
    />
  </div>
</template>
