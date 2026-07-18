<!-- app\pages\player\[slug]\deck\[deckSlug].vue -->
<script setup lang="ts">
import type { CommanderDeck } from '#shared/utils/types'

const route = useRoute()
const slug = route.params.slug as string
const deckSlug = route.params.deckSlug as string

const { t } = useI18n()

const { player, playerId } = usePlayerBySlug(slug)

// Colada cache of the player's decks (ADR-015)
const { decks: playerDecks } = usePlayerDecks(playerId)

// Look up deck by commander 1 slug match (or exact name)
const deck = computed(() => {
  return playerDecks.value.find((d: CommanderDeck) => {
    const c1Slug = slugify(d.commander_1_name)
    return c1Slug === deckSlug
  }) ?? null
})

const { data: deckStats } = useDeckStats(
  playerId,
  computed(() => deck.value?.commander_1_name),
  computed(() => deck.value?.commander_2_name ?? null)
)

const { commander1Data, commander2Data, loading: cardLoading } = useCommanderCards(
  computed(() => deck.value?.commander_1_name ?? null),
  computed(() => deck.value?.commander_2_name ?? null)
)

const { commanderDisplayName, scryfallSearchUrl } = useDeckDisplay(deck)

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('player.breadcrumb'), to: '/players' },
  {
    label: player.value ? `${player.value.player_name} ${player.value.player_surname}` : t('player.fallbackName'),
    to: `/player/${slug}`
  },
  { label: commanderDisplayName.value }
])
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <div v-if="deck" class="bg-elevated rounded-xl p-6 border border-default shadow-lg space-y-6">
      <DeckHeader
        :display-name="commanderDisplayName"
        :mana-cost="commander1Data?.manaCost"
        :loading="cardLoading"
        :companion-name="deck.companion_name"
      />

      <DeckStatsRow
        :first-icon="ICONS.calendarDays"
        :first-value="deckStats?.events_played ?? 0"
        :first-label="t('player.stats.events')"
        :matches="deckStats?.total_matches ?? 0"
        :wins="deckStats?.total_wins ?? 0"
        :kills="deckStats?.total_kills ?? 0"
        :average="deckStats?.average_score ?? 0"
      />

      <CommanderArtGallery
        :image1="commander1Data?.imageUrl ?? null"
        :image1-alt="t('deck.artAlt', { name: deck.commander_1_name })"
        :has-partner="!!deck.commander_2_name"
        :image2="commander2Data?.imageUrl ?? null"
        :image2-alt="deck.commander_2_name ? t('deck.artAlt', { name: deck.commander_2_name }) : ''"
        :loading="cardLoading"
      />

      <ScryfallLinkButton :url="scryfallSearchUrl" />
    </div>

    <DeckNotFound v-else />
  </div>
</template>
