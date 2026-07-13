<!-- app\pages\player\[slug]\deck\[deckSlug].vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { useCommanderCards } from '~/composables/commanders/useCommanderCards'
import type { CommanderDeck } from '#shared/utils/types'

const route = useRoute()
const slug = route.params.slug as string
const deckSlug = route.params.deckSlug as string

const { t } = useI18n()

const commanderDecksStore = useCommanderDeckStore()

const { player, playerId } = usePlayerBySlug(slug)

// Look up deck by commander 1 slug match (or exact name)
const deck = computed(() => {
  if (!playerId.value) return null
  const decks = commanderDecksStore.getDecksByPlayerId(playerId.value)
  return decks.find((d: CommanderDeck) => {
    const c1Slug = slugify(d.commander_1_name)
    return c1Slug === deckSlug
  }) ?? null
})

const { data: deckStats } = useDeckStats(
  playerId,
  computed(() => deck.value?.commander_1_name),
  computed(() => deck.value?.commander_2_name ?? null)
)

const { commander1Data, commander2Data, loading: cardLoading, fetchAllData } = useCommanderCards(
  computed(() => deck.value?.commander_1_name ?? null),
  computed(() => deck.value?.commander_2_name ?? null)
)

const commanderDisplayName = computed(() => {
  if (deck.value?.commander_2_name) {
    return `${deck.value.commander_1_name} // ${deck.value.commander_2_name}`
  }
  return deck.value?.commander_1_name ?? t('deck.fallbackName')
})

const scryfallSearchUrl = computed(() => {
  if (!deck.value) return '#'
  return `https://scryfall.com/search?q=!"${encodeURIComponent(deck.value.commander_1_name)}"`
})

const breadcrumbItems = computed(() => [
  { label: t('common.home'), to: '/' },
  { label: t('player.breadcrumb'), to: '/players' },
  {
    label: player.value ? `${player.value.player_name} ${player.value.player_surname}` : t('player.fallbackName'),
    to: player.value ? `/player/${slug}` : undefined
  },
  { label: commanderDisplayName.value }
])

onMounted(() => {
  if (playerId.value && commanderDecksStore.getDecksByPlayerId(playerId.value).length === 0) {
    commanderDecksStore.fetchDecksByPlayer(playerId.value)
  }
  fetchAllData()
})

watch(() => deck.value?.commander_1_name, () => {
  fetchAllData()
})
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <div v-if="deck" class="bg-elevated rounded-xl p-6 border border-default shadow-lg space-y-6">
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
              v-else-if="cardLoading"
              :name="ICONS.loading"
              class="animate-spin size-4 text-muted"
            />
            <UBadge v-if="deck.companion_name" variant="soft" color="error" class="text-xs">
              <UIcon :name="ICONS.favorite" class="size-3 mr-1" />
              {{ deck.companion_name }}
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Deck Stats — compact horizontal bar -->
      <div class="grid grid-cols-3 sm:grid-cols-5 gap-3">
        <StatTile
          :icon="ICONS.calendarDays"
          :value="deckStats?.events_played ?? 0"
          :label="t('player.stats.events')"
        />
        <StatTile
          :icon="ICONS.battle"
          :value="deckStats?.total_matches ?? 0"
          :label="t('player.stats.matches')"
        />
        <StatTile
          :icon="ICONS.standings"
          color="text-warning"
          :value="deckStats?.total_wins ?? 0"
          :label="t('player.stats.wins')"
        />
        <StatTile
          :icon="ICONS.kills"
          color="text-error"
          :value="deckStats?.total_kills ?? 0"
          :label="t('player.stats.kills')"
        />
        <StatTile
          :icon="ICONS.vote"
          color="text-success"
          :value="deckStats?.average_score ?? 0"
          :label="t('player.stats.average')"
        />
      </div>

      <!-- Card Art Gallery: same total height for single or partner -->
      <div
        class="overflow-hidden rounded-lg bg-muted"
        :class="deck.commander_2_name ? 'aspect-2/3 flex flex-col gap-1' : 'aspect-2/3'"
      >
        <div class="relative h-full w-full">
          <img
            v-if="commander1Data?.imageUrl"
            :src="commander1Data.imageUrl"
            :alt="t('deck.artAlt', { name: deck.commander_1_name })"
            class="w-full h-full object-cover object-top"
          >
          <div v-else-if="cardLoading" class="flex items-center justify-center h-full">
            <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-muted" />
          </div>
          <div v-else class="flex items-center justify-center h-full text-muted">
            <UIcon :name="ICONS.imageMissing" class="text-4xl opacity-30" />
          </div>
        </div>
        <div v-if="deck.commander_2_name" class="relative h-full w-full">
          <img
            v-if="commander2Data?.imageUrl"
            :src="commander2Data.imageUrl"
            :alt="t('deck.artAlt', { name: deck.commander_2_name })"
            class="w-full h-full object-cover object-top"
          >
          <div v-else-if="cardLoading" class="flex items-center justify-center h-full">
            <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-muted" />
          </div>
          <div v-else class="flex items-center justify-center h-full text-muted">
            <UIcon :name="ICONS.imageMissing" class="text-4xl opacity-30" />
          </div>
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
          {{ t('deck.viewOnScryfall') }}
        </UButton>
      </div>
    </div>

    <div v-else class="text-center py-12 text-muted">
      <UIcon :name="ICONS.noCommander" class="text-4xl mb-2 opacity-30" />
      <p>{{ t('deck.notFound') }}</p>
    </div>
  </div>
</template>
