<!-- app\pages\deck\[deckSlug].vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
import { slugify } from '~/utils/slug'
import { getArtCrop, useCommanderCards } from '~/composables/commanders/useCommanderCards'
import { useCommanderStats } from '~/composables/supabase/useCommanderStats'
import type { CommanderDeck } from '#shared/utils/types'

const route = useRoute()
const deckSlug = route.params.deckSlug as string

const commanderDecksStore = useCommanderDeckStore()
const playersStore = usePlayerStore()

// Fetch all decks and players
onMounted(() => {
  commanderDecksStore.fetchDecks()
  if (playersStore.players.length === 0) {
    playersStore.fetchPlayers()
  }
})

// Find all decks with matching commander_1_name slug
const matchingDecks = computed(() => {
  return commanderDecksStore.decks.filter((d: CommanderDeck) =>
    slugify(d.commander_1_name) === deckSlug
  )
})

// First deck for display info (they should all have same commander name)
const firstDeck = computed(() => matchingDecks.value[0] ?? null)

// Player info for each deck
const decksWithPlayers = computed(() => {
  return matchingDecks.value.map((deck: CommanderDeck) => {
    const player = playersStore.players.find(p => p.player_id === deck.player_id)
    return {
      deck,
      player,
      playerSlug: player ? slugify(`${player.player_name} ${player.player_surname}`) : ''
    }
  })
})

// Scryfall data for the commander
const commander1Name = computed(() => firstDeck.value?.commander_1_name ?? '')
const commander2Name = computed(() => firstDeck.value?.commander_2_name ?? undefined)

const { commander1Data, commander2Data, loading: scryfallLoading, fetchAllData } = useCommanderCards(
  commander1Name,
  commander2Name
)

const art1 = computed(() => getArtCrop(commander1Data.value))
const art2 = computed(() => getArtCrop(commander2Data.value))

// Aggregate commander stats across all players
const { data: commanderStats } = useCommanderStats(
  commander1Name,
  commander2Name
)

const commanderDisplayName = computed(() => {
  if (firstDeck.value?.commander_2_name) {
    return `${firstDeck.value.commander_1_name} // ${firstDeck.value.commander_2_name}`
  }
  return firstDeck.value?.commander_1_name ?? 'Deck sconosciuto'
})

const scryfallSearchUrl = computed(() => {
  if (!firstDeck.value) return '#'
  return `https://scryfall.com/search?q=!"${encodeURIComponent(firstDeck.value.commander_1_name)}"`
})

const breadcrumbItems = computed(() => [
  { label: 'Home', to: '/' },
  { label: 'Deck', to: '/decks' },
  { label: commanderDisplayName.value }
])

watch(() => firstDeck.value?.commander_1_name, () => {
  if (firstDeck.value?.commander_1_name) {
    fetchAllData()
  }
})
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <div v-if="firstDeck" class="bg-elevated rounded-xl p-6 border border-default shadow-lg space-y-6">
      <!-- Deck Header -->
      <div class="flex items-center gap-4">
        <UIcon :name="ICONS.battle" class="size-8 text-primary" />
        <div class="min-w-0">
          <h1 class="text-2xl font-bold truncate">
            {{ commanderDisplayName }}
          </h1>
          <div class="flex items-center gap-2 mt-1">
            <ManaCost
              v-if="commander1Data?.manaCost"
              :mana-cost="commander1Data.manaCost"
              size="md"
            />
            <UIcon
              v-else-if="scryfallLoading"
              :name="ICONS.loading"
              class="animate-spin size-4 text-muted"
            />
            <UBadge v-if="firstDeck.companion_name" variant="soft" color="error" class="text-xs">
              <UIcon :name="ICONS.favorite" class="size-3 mr-1" />
              {{ firstDeck.companion_name }}
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Card Art Gallery: same total height for single or partner -->
      <div
        class="overflow-hidden rounded-lg bg-muted"
        :class="firstDeck.commander_2_name ? 'aspect-[2/3] flex flex-col gap-1' : 'aspect-[2/3]'"
      >
        <div class="relative h-full w-full">
          <img
            v-if="art1"
            :src="art1"
            :alt="`Card art for ${firstDeck.commander_1_name}`"
            class="w-full h-full object-cover object-top"
          >
          <div v-else-if="scryfallLoading" class="flex items-center justify-center h-full">
            <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-muted" />
          </div>
          <div v-else class="flex items-center justify-center h-full text-muted">
            <UIcon :name="ICONS.imageMissing" class="text-4xl opacity-30" />
          </div>
        </div>
        <div v-if="firstDeck.commander_2_name" class="relative h-full w-full">
          <img
            v-if="art2"
            :src="art2"
            :alt="`Card art for ${firstDeck.commander_2_name}`"
            class="w-full h-full object-cover object-top"
          >
          <div v-else-if="scryfallLoading" class="flex items-center justify-center h-full">
            <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-muted" />
          </div>
          <div v-else class="flex items-center justify-center h-full text-muted">
            <UIcon :name="ICONS.imageMissing" class="text-4xl opacity-30" />
          </div>
        </div>
      </div>

      <!-- Aggregate Commander Stats -->
      <div class="grid grid-cols-3 sm:grid-cols-5 gap-3">
        <div class="flex items-center gap-3 p-3 bg-default rounded-lg">
          <UIcon :name="ICONS.players" class="size-5 text-primary shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ commanderStats?.player_count ?? 0 }}</p>
            <p class="text-xs text-muted">Giocatori</p>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-default rounded-lg">
          <UIcon :name="ICONS.battle" class="size-5 text-primary shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ commanderStats?.match_count ?? 0 }}</p>
            <p class="text-xs text-muted">Match</p>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-default rounded-lg">
          <UIcon :name="ICONS.standings" class="size-5 text-warning shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ commanderStats?.win_count ?? 0 }}</p>
            <p class="text-xs text-muted">Vittorie</p>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-default rounded-lg">
          <UIcon :name="ICONS.kills" class="size-5 text-error shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ commanderStats?.total_kills ?? 0 }}</p>
            <p class="text-xs text-muted">Uccisioni</p>
          </div>
        </div>

        <div class="flex items-center gap-3 p-3 bg-default rounded-lg">
          <UIcon :name="ICONS.vote" class="size-5 text-success shrink-0" />
          <div>
            <p class="text-xl font-bold leading-none">{{ commanderStats?.average_score ?? 0 }}</p>
            <p class="text-xs text-muted">Media</p>
          </div>
        </div>
      </div>

      <!-- Players with this deck -->
      <div class="space-y-3">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <UIcon :name="ICONS.players" class="size-5 text-primary" />
          Giocatori con questo deck
        </h2>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="{ deck, player, playerSlug } in decksWithPlayers"
            :key="deck.id"
            :to="`/player/${playerSlug}/deck/${deckSlug}`"
            variant="soft"
            color="primary"
            size="sm"
            :icon="ICONS.player"
          >
            {{ player ? `${player.player_name} ${player.player_surname}` : 'Giocatore sconosciuto' }}
            <span v-if="deck.is_borrowed" class="ml-1 text-warning">
              (Prestato)
            </span>
          </UButton>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <UButton
          :icon="ICONS.externalLink"
          :to="scryfallSearchUrl"
          target="_blank"
          color="neutral"
          variant="outline"
        >
          Vedi su Scryfall
        </UButton>
      </div>
    </div>

    <div v-else class="text-center py-12 text-muted">
      <UIcon :name="ICONS.noCommander" class="text-4xl mb-2 opacity-30" />
      <p>Deck non trovato</p>
    </div>
  </div>
</template>
