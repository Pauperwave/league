<!-- app\pages\player\[slug]\index.vue -->
<script setup lang="ts">
import type { CommanderDeck } from '#shared/utils/types'
import type { DeckFormPayload, DeckUpdatePayload } from '~/composables/deck/useDeckMutations'

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

const { createDeck, updateDeck, deleteDeck } = useDeckMutations()
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

function notifyDeckSuccess(titleKey: string, descriptionKey: string) {
  useToast().add({
    title: t(titleKey),
    description: t(descriptionKey),
    color: 'success',
    icon: ICONS.confirm
  })
}

function notifyDeckError(description: string) {
  useToast().add({
    title: t('deck.toast.errorTitle'),
    description,
    color: 'error',
    icon: ICONS.close
  })
}

async function handleUpdateDeck({ id, updates }: DeckUpdatePayload) {
  try {
    await updateDeck.mutateAsync({ id, updates })
  } catch (err) {
    notifyDeckError(toErrorMessage(err, t('deck.toast.updateErrorFallback')))
    return
  }
  notifyDeckSuccess('deck.toast.updatedTitle', 'deck.toast.updatedDescription')
}

async function handleCreateDeck(deckData: DeckFormPayload) {
  try {
    await createDeck.mutateAsync(deckData)
  } catch (err) {
    notifyDeckError(toErrorMessage(err, t('deck.toast.createErrorFallback')))
    return
  }
  notifyDeckSuccess('deck.toast.createdTitle', 'deck.toast.createdDescription')
}

function handleDeleteClick(deck: CommanderDeck) {
  if (isDeckInUse(deck)) return
  deckToDelete.value = deck
  deleteModalOpen.value = true
}

async function confirmDeleteDeck() {
  if (!deckToDelete.value) return
  deleteLoading.value = true

  try {
    await deleteDeck.mutateAsync(deckToDelete.value.id)
    notifyDeckSuccess('deck.toast.deletedTitle', 'deck.toast.deletedDescription')
  } catch (err) {
    // The endpoint answers 409 when the deck was played in an event.
    notifyDeckError(isConflictError(err)
      ? t('store.deck.inUseError')
      : toErrorMessage(err, t('deck.toast.deleteErrorFallback')))
  } finally {
    deleteLoading.value = false
    deleteModalOpen.value = false
    deckToDelete.value = null
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
