<!-- app\pages\player\[slug]\index.vue -->
<script setup lang="ts">
import type { CommanderDeck } from '#shared/utils/types'

const route = useRoute()
const slug = route.params.slug as string

const { player, playerId } = usePlayerBySlug(slug)

const breadcrumbItems = computed(() => [
  { label: 'Home', to: '/' },
  { label: 'Giocatori', to: '/players' },
  { label: player.value ? `${player.value.player_name} ${player.value.player_surname}` : 'Profilo' }
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
      title: 'Deck aggiornato',
      description: 'Le informazioni di proprietà sono state salvate',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } else {
    useToast().add({
      title: 'Errore',
      description: result.error || 'Impossibile aggiornare il deck',
      color: 'error',
      icon: 'i-lucide-x'
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
      title: 'Deck creato',
      description: 'Il deck è stato aggiunto con successo',
      color: 'success',
      icon: 'i-lucide-check'
    })
    // Refresh the composable data
    refreshNuxtData(`commander-decks-usage-by-player-${playerId.value}`)
  } else {
    useToast().add({
      title: 'Errore',
      description: result.error || 'Impossibile creare il deck',
      color: 'error',
      icon: 'i-lucide-x'
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
      title: 'Deck eliminato',
      description: 'Il deck è stato rimosso con successo',
      color: 'success',
      icon: 'i-lucide-check'
    })
    refreshNuxtData(`commander-decks-usage-by-player-${playerId.value}`)
  } else {
    useToast().add({
      title: 'Errore',
      description: result.error || 'Impossibile eliminare il deck',
      color: 'error',
      icon: 'i-lucide-x'
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
        Profilo giocatore
      </template>
    </h1>

    <div v-if="player" class="bg-elevated rounded-xl p-6 border border-default shadow-lg space-y-6">
      <!-- Profile Header -->
      <div class="flex items-center gap-4">
        <UAvatar size="lg" icon="i-lucide-user">
          {{ player.player_name?.charAt(0).toUpperCase() ?? '?' }}
        </UAvatar>
        <div>
          <div class="text-2xl font-bold">
            {{ player.player_name }}
            <span class="text-primary">{{ player.player_surname }}</span>
          </div>
          <p class="text-muted text-sm">ID: {{ player.player_id }}</p>
        </div>
      </div>

      <!-- Player Stats — compact horizontal bar -->
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
          <UIcon name="i-lucide-calendar-days" class="size-5 text-primary shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ playerStats?.events_played ?? 0 }}</p>
            <p class="text-xs text-muted">Eventi</p>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
          <UIcon name="i-lucide-swords" class="size-5 text-primary shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ playerStats?.total_matches ?? 0 }}</p>
            <p class="text-xs text-muted">Match</p>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
          <UIcon name="i-lucide-trophy" class="size-5 text-warning shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ playerStats?.total_wins ?? 0 }}</p>
            <p class="text-xs text-muted">Vittorie</p>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
          <UIcon name="i-lucide-skull" class="size-5 text-error shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ playerStats?.total_kills ?? 0 }}</p>
            <p class="text-xs text-muted">Uccisioni</p>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
          <UIcon name="i-lucide-star" class="size-5 text-success shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ playerStats?.average_score ?? 0 }}</p>
            <p class="text-xs text-muted">Media</p>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
          <UIcon name="i-lucide-shield" class="size-5 text-info shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ ownedDeckCount }}</p>
            <p class="text-xs text-muted">Mazzi</p>
            <p v-if="borrowedDeckCount > 0" class="text-xs text-warning">+{{ borrowedDeckCount }} prestati</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Match History Table -->
    <div v-if="player && matchHistory && matchHistory.length > 0" class="bg-elevated rounded-xl p-6 border border-default shadow-lg">
      <div class="flex items-center gap-2 mb-4">
        <UIcon name="i-lucide-swords" class="size-5 text-primary" />
        <h2 class="text-lg font-bold">Storico Partite</h2>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default">
              <th class="text-left py-2 px-3 text-muted font-medium">Evento</th>
              <th class="text-center py-2 px-3 text-muted font-medium">Round</th>
              <th class="text-center py-2 px-3 text-muted font-medium">Tavolo</th>
              <th class="text-left py-2 px-3 text-muted font-medium">Commander</th>
              <th class="text-center py-2 px-3 text-muted font-medium">Pos</th>
              <th class="text-center py-2 px-3 text-muted font-medium">Kill</th>
              <th class="text-right py-2 px-3 text-muted font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="match in matchHistory"
              :key="match.pairing_id"
              class="border-b border-default/50 hover:bg-elevated/50 transition-colors"
            >
              <td class="py-2 px-3">
                <NuxtLink
                  :to="`/league/${match.league_id}/event/${match.event_id}`"
                  class="text-primary hover:underline"
                >
                  {{ match.event_name }}
                </NuxtLink>
              </td>
              <td class="text-center py-2 px-3">{{ match.pairing_round }}</td>
              <td class="text-center py-2 px-3">{{ match.table_number }}</td>
              <td class="py-2 px-3">
                <div class="flex items-center gap-1">
                  <span>{{ match.commander_1 ?? '—' }}</span>
                  <span v-if="match.commander_2" class="text-muted">+ {{ match.commander_2 }}</span>
                </div>
              </td>
              <td class="text-center py-2 px-3">
                <UBadge
                  :color="match.position === 1 ? 'warning' : 'neutral'"
                  variant="soft"
                  size="xs"
                >
                  {{ match.position }}°
                </UBadge>
              </td>
              <td class="text-center py-2 px-3">{{ match.number_of_kills }}</td>
              <td class="text-right py-2 px-3 text-muted">
                {{ new Date(match.pairing_datetime).toLocaleDateString('it-IT') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Commander Decks Section -->
    <div v-if="player" class="bg-elevated rounded-xl p-6 border border-default shadow-lg">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-shield" class="size-5 text-primary" />
          <h2 class="text-lg font-bold">Commander Decks</h2>
        </div>
        <UButton
          size="sm"
          color="primary"
          variant="soft"
          icon="i-lucide-plus"
          @click="createModalOpen = true"
        >
          Aggiungi Deck
        </UButton>
      </div>

      <div v-if="decksLoading" class="flex items-center justify-center py-8">
        <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-primary" />
      </div>

      <div v-else-if="commanderDecks && commanderDecks.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CommanderDeckCard
          v-for="deck in commanderDecks"
          :key="deck.id"
          :deck="deck"
          :player-slug="slug"
          :event-count="getDeckEventCount(deck)"
          show-actions
          @edit="handleEditDeck"
          @delete="handleDeleteClick"
        />
      </div>

      <div v-else class="text-center py-8 text-muted">
        <UIcon name="i-lucide-shield-off" class="text-4xl mb-2 opacity-30" />
        <p>Nessun commander deck registrato</p>
      </div>
    </div>

    <div v-else class="text-center py-12 text-muted">
      <UIcon name="i-lucide-user-x" class="text-4xl mb-2 opacity-30" />
      <p>Giocatore non trovato</p>
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
      title="Elimina Deck"
      description="Conferma eliminazione"
      :subject="deckToDelete?.commander_1_name ?? ''"
      question="Sei sicuro di voler eliminare il deck"
      warning="Questa azione non può essere annullata."
      confirm-label="Elimina"
      cancel-label="Annulla"
      confirm-icon="i-lucide-trash-2"
      :loading="deleteLoading"
      @confirm="confirmDeleteDeck"
    />
  </div>
</template>
