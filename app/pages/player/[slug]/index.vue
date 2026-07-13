<!-- app\pages\player\[slug]\index.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import type { CommanderDeck } from '#shared/utils/types'

const route = useRoute()
const slug = route.params.slug as string

const { t } = useI18n()

const { player, playerId } = usePlayerBySlug(slug)

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('player.breadcrumb'), to: '/players' },
  { label: player.value ? `${player.value.player_name} ${player.value.player_surname}` : t('player.fallbackName') }
])

// Fetch commander decks for this player
const {
  data: commanderDecks,
  pending: decksLoading,
  isDeckInUse,
  getDeckEventCount
} = useCommanderDecks(playerId)

const { data: playerStats } = usePlayerStats(playerId)

const deckStore = useCommanderDeckStore()
const editModalOpen = ref(false)
const editingDeck = ref<CommanderDeck | null>(null)

const createModalOpen = ref(false)

const deleteModalOpen = ref(false)
const deckToDelete = ref<CommanderDeck | null>(null)
const deleteLoading = ref(false)

function handleEditDeck(deck: CommanderDeck) {
  editingDeck.value = deck
  editModalOpen.value = true
}

async function handleUpdateDeck({ id, updates }: { id: number; updates: Partial<CommanderDeck> }) {
  const result = await deckStore.updateDeck(id, updates)
  if (result.success) {
    useToast().add({
      title: t('deck.toast.updatedTitle'),
      description: t('deck.toast.updatedDescription'),
      color: 'success',
      icon: ICONS.confirm
    })
  } else {
    useToast().add({
      title: t('deck.toast.errorTitle'),
      description: result.error || t('deck.toast.updateErrorFallback'),
      color: 'error',
      icon: ICONS.close
    })
  }
}

async function handleCreateDeck(deckData: {
  player_id: number
  commander_1_name: string
  commander_2_name: string | null
  companion_name: string | null
  is_borrowed: boolean
  lender_id: number | null
}) {
  const result = await deckStore.createDeck(deckData)
  if (result.success) {
    useToast().add({
      title: t('deck.toast.createdTitle'),
      description: t('deck.toast.createdDescription'),
      color: 'success',
      icon: ICONS.confirm
    })
    // Refresh the composable data
    refreshNuxtData(`commander-decks-usage-by-player-${playerId.value}`)
  } else {
    useToast().add({
      title: t('deck.toast.errorTitle'),
      description: result.error || t('deck.toast.createErrorFallback'),
      color: 'error',
      icon: ICONS.close
    })
  }
}

function handleDeleteClick(deck: CommanderDeck) {
  if (isDeckInUse(deck)) return
  deckToDelete.value = deck
  deleteModalOpen.value = true
}

async function confirmDeleteDeck() {
  if (!deckToDelete.value) return
  deleteLoading.value = true

  const result = await deckStore.deleteDeck(deckToDelete.value.id)

  deleteLoading.value = false
  deleteModalOpen.value = false
  deckToDelete.value = null

  if (result.success) {
    useToast().add({
      title: t('deck.toast.deletedTitle'),
      description: t('deck.toast.deletedDescription'),
      color: 'success',
      icon: ICONS.confirm
    })
    refreshNuxtData(`commander-decks-usage-by-player-${playerId.value}`)
  } else {
    useToast().add({
      title: t('deck.toast.errorTitle'),
      description: result.error || t('deck.toast.deleteErrorFallback'),
      color: 'error',
      icon: ICONS.close
    })
  }
}

const ownedDeckCount = computed(() => commanderDecks.value?.filter((d: CommanderDeck) => !d.is_borrowed).length ?? 0)
const borrowedDeckCount = computed(() => commanderDecks.value?.filter((d: CommanderDeck) => d.is_borrowed).length ?? 0)

// Match history
const { data: matchHistory } = usePlayerMatchHistory(playerId)
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Level-one heading: always present for accessibility -->
    <h1 class="text-2xl font-bold">
      <template v-if="player">
        {{ player.player_name }}
        <span class="text-primary">{{ player.player_surname }}</span>
      </template>
      <template v-else>
        {{ t('player.profileFallbackHeading') }}
      </template>
    </h1>

    <PlayerProfileHeader
      v-if="player"
      :player="player"
      :player-stats="playerStats"
      :owned-deck-count="ownedDeckCount"
      :borrowed-deck-count="borrowedDeckCount"
    />

    <PlayerMatchHistoryTable
      v-if="player && matchHistory && matchHistory.length > 0"
      :match-history="matchHistory"
    />

    <PlayerDecksSection
      v-if="player"
      :loading="decksLoading"
      :decks="commanderDecks ?? []"
      :slug="slug"
      :get-event-count="getDeckEventCount"
      @add-deck="createModalOpen = true"
      @edit="handleEditDeck"
      @delete="handleDeleteClick"
    />

    <div v-else class="text-center py-12 text-muted">
      <UIcon :name="ICONS.removePlayer" class="text-4xl mb-2 opacity-30" />
      <p>{{ t('player.notFound') }}</p>
    </div>

    <DeckEditModal
      v-model:open="editModalOpen"
      :deck="editingDeck"
      :player-id="playerId ?? 0"
      @update="handleUpdateDeck"
    />

    <DeckCreateModal
      v-model:open="createModalOpen"
      :player-id="playerId ?? 0"
      @create="handleCreateDeck"
    />

    <ConfirmModal
      v-model:open="deleteModalOpen"
      :title="t('deck.confirmDeleteTitle')"
      :description="t('deck.confirmDeleteDescription')"
      :subject="deckToDelete?.commander_1_name ?? ''"
      :question="t('deck.confirmDeleteQuestion')"
      :confirm-icon="ICONS.delete"
      :loading="deleteLoading"
      @confirm="confirmDeleteDeck"
    />
  </div>
</template>
