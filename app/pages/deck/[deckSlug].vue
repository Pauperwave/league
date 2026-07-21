<!-- app\pages\deck\[deckSlug].vue -->
<script setup lang="ts">
import type { CommanderDeck } from '#shared/utils/types'

const route = useRoute()
const deckSlug = route.params.deckSlug as string

const { t } = useI18n()

// Colada caches of all decks and players (ADR-015) — auto-fetched, SSR
const { data: decksData } = useDecksQuery()
const { data: playersData } = usePlayersQuery()

// Find all decks with matching commander_1_name slug
const matchingDecks = computed(() => {
  return (decksData.value ?? []).filter((d: CommanderDeck) =>
    slugify(d.commander_1_name) === deckSlug
  )
})

// First deck for display info (they should all have same commander name)
const firstDeck = computed(() => matchingDecks.value[0] ?? null)

// Player info for each deck
const decksWithPlayers = computed(() => {
  return matchingDecks.value.map((deck: CommanderDeck) => {
    const player = (playersData.value ?? []).find(p => p.player_id === deck.player_id)
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

const { commander1Data, commander2Data, loading: scryfallLoading } = useCommanderCards(
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

const { commanderDisplayName, scryfallSearchUrl } = useDeckDisplay(firstDeck)

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('deck.breadcrumb'), to: '/decks' },
  { label: commanderDisplayName.value }
])
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <div v-if="firstDeck" class="bg-elevated rounded-xl p-6 border border-default shadow-lg space-y-6">
      <DeckHeader
        :display-name="commanderDisplayName"
        :mana-cost="commander1Data?.manaCost"
        :loading="scryfallLoading"
        :companion-name="firstDeck.companion_name"
      />

      <!-- Solo stats for each half of the pair (BACKLOG #10) -->
      <div class="flex flex-wrap gap-2 -mt-4">
        <UButton
          :to="`/commander/${slugify(firstDeck.commander_1_name)}`"
          variant="ghost"
          color="neutral"
          size="xs"
          :icon="ICONS.statsLink"
        >
          {{ t('commander.page.viewSoloStats') }}: {{ firstDeck.commander_1_name }}
        </UButton>
        <UButton
          v-if="firstDeck.commander_2_name"
          :to="`/commander/${slugify(firstDeck.commander_2_name)}`"
          variant="ghost"
          color="neutral"
          size="xs"
          :icon="ICONS.statsLink"
        >
          {{ t('commander.page.viewSoloStats') }}: {{ firstDeck.commander_2_name }}
        </UButton>
      </div>

      <CommanderArtGallery
        :image1="art1"
        :image1-alt="t('deck.artAlt', { name: firstDeck.commander_1_name })"
        :has-partner="!!firstDeck.commander_2_name"
        :image2="art2"
        :image2-alt="firstDeck.commander_2_name ? t('deck.artAlt', { name: firstDeck.commander_2_name }) : ''"
        :loading="scryfallLoading"
      />

      <DeckStatsRow
        :first-icon="ICONS.players"
        :first-value="commanderStats?.player_count ?? 0"
        :first-label="t('deck.statsPlayers')"
        :matches="commanderStats?.match_count ?? 0"
        :wins="commanderStats?.win_count ?? 0"
        :kills="commanderStats?.total_kills ?? 0"
        :average="commanderStats?.average_score ?? 0"
      />

      <!-- Players with this deck -->
      <div class="space-y-3">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <UIcon :name="ICONS.players" class="size-5 text-primary" />
          {{ t('deck.playersUsingHeading') }}
        </h2>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="{ deck, player, playerSlug } in decksWithPlayers"
            :key="deck.id"
            :to="`/player/${playerSlug}/deck/${deckSlug}`"
            variant="soft"
            color="primary"
            size="sm"
          >
            <PlayerNameTag
              v-if="player"
              :name="player.player_name"
              :surname="player.player_surname"
              :player-id="player.player_id"
              :linkable="false"
              avatar-size="xs"
            />
            <span v-else>{{ t('deck.unknownPlayer') }}</span>
            <span v-if="deck.is_borrowed" class="ml-1 text-warning">
              {{ t('deck.borrowedBadge') }}
            </span>
          </UButton>
        </div>
      </div>

      <ScryfallLinkButton :url="scryfallSearchUrl" />
    </div>

    <DeckNotFound v-else />
  </div>
</template>
