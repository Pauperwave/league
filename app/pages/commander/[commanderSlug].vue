<!-- app\pages\commander\[commanderSlug].vue -->
<script setup lang="ts">
import type { CommanderDeck } from '#shared/utils/types'

const route = useRoute()
const commanderSlug = route.params.commanderSlug as string

const { t } = useI18n()

// Colada caches (ADR-015) — auto-fetched, SSR
const { data: decksData } = useDecksQuery()
const { data: playersData } = usePlayersQuery()

// Resolve the exact-cased commander name from the slug — checked against
// BOTH the commander_1 and commander_2 slot of every deck, since this page
// is about the individual card regardless of which side of a partnership
// it's been played on.
const commanderName = computed(() => {
  for (const deck of decksData.value ?? []) {
    if (slugify(deck.commander_1_name) === commanderSlug) return deck.commander_1_name
    if (deck.commander_2_name && slugify(deck.commander_2_name) === commanderSlug) return deck.commander_2_name
  }
  return null
})

const { commander1Data: commanderData, loading: scryfallLoading } = useCommanderCards(commanderName, undefined)
const art = computed(() => getArtCrop(commanderData.value))

// Single-commander aggregate, summed across every pair this commander has
// appeared in (BACKLOG #10) — see useCommanderAggregate.ts for the caveats.
const { data: stats } = useSingleCommanderStats(commanderName)

// Every deck featuring this commander, in either slot — always link through
// the deck's own commander_1 slug (guaranteed to resolve on the per-player
// deck page), and surface the partner's name when this commander was played
// as the second slot of a pair.
const decksFeaturing = computed(() => {
  const name = commanderName.value
  if (!name) return []

  return (decksData.value ?? [])
    .filter((deck: CommanderDeck) => deck.commander_1_name === name || deck.commander_2_name === name)
    .map((deck: CommanderDeck) => {
      const player = (playersData.value ?? []).find(p => p.player_id === deck.player_id)
      const isPartnerSlot = deck.commander_2_name === name
      const partnerName = isPartnerSlot ? deck.commander_1_name : deck.commander_2_name

      return {
        deck,
        player,
        playerSlug: player ? slugify(`${player.player_name} ${player.player_surname}`) : '',
        deckSlug: slugify(deck.commander_1_name),
        partnerName,
      }
    })
})

const scryfallSearchUrl = computed(() =>
  commanderName.value ? `https://scryfall.com/search?q=!"${encodeURIComponent(commanderName.value)}"` : '#'
)

const { textColor, mutedColor, tooltipTheme } = useChartTheme()

const winRateOption = computed<ECOption>(() => {
  const wins = stats.value?.winCount ?? 0
  const matches = stats.value?.matchCount ?? 0
  const others = Math.max(matches - wins, 0)
  const winRatePercent = matches > 0 ? Math.round((wins / matches) * 100) : 0

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', ...tooltipTheme.value },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: textColor.value },
    },
    title: {
      text: `${winRatePercent}%`,
      subtext: t('commander.page.chartWins'),
      left: 'center',
      top: '40%',
      textStyle: { fontSize: 26, fontWeight: 700, color: textColor.value },
      subtextStyle: { fontSize: 12, color: mutedColor.value },
    },
    series: [{
      type: 'pie',
      radius: ['62%', '82%'],
      center: ['50%', '46%'],
      label: { show: false },
      labelLine: { show: false },
      data: [
        { value: wins, name: t('commander.page.chartWins'), itemStyle: { color: '#10b981' } },
        { value: others, name: t('commander.page.chartOtherMatches'), itemStyle: { color: '#9ca3af' } },
      ],
    }],
  }
})

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('deck.breadcrumb'), to: '/decks' },
  { label: commanderName.value ?? t('deck.fallbackName') }
])
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <div v-if="commanderName" class="bg-elevated rounded-xl p-6 border border-default shadow-lg space-y-6">
      <DeckHeader
        :display-name="commanderName"
        :mana-cost="commanderData?.manaCost"
        :loading="scryfallLoading"
      />

      <CommanderArtGallery
        :image1="art"
        :image1-alt="t('deck.artAlt', { name: commanderName })"
        :loading="scryfallLoading"
      />

      <DeckStatsRow
        :first-icon="ICONS.players"
        :first-value="stats?.playerCount ?? 0"
        :first-label="t('deck.statsPlayers')"
        :matches="stats?.matchCount ?? 0"
        :wins="stats?.winCount ?? 0"
        :kills="stats?.totalKills ?? 0"
        :average="stats?.averageScore ?? 0"
      />

      <!-- Win rate -->
      <div v-if="stats && stats.matchCount > 0" class="space-y-3">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <UIcon :name="ICONS.standings" class="size-5 text-primary" />
          {{ t('commander.page.winRateHeading') }}
        </h2>
        <BaseChart :option="winRateOption" height="20rem" />
      </div>

      <!-- Decks featuring this commander, solo or partnered -->
      <div class="space-y-3">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <UIcon :name="ICONS.players" class="size-5 text-primary" />
          {{ t('commander.page.decksHeading') }}
        </h2>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="{ deck, player, playerSlug, deckSlug, partnerName } in decksFeaturing"
            :key="deck.id"
            :to="`/player/${playerSlug}/deck/${deckSlug}`"
            variant="soft"
            color="primary"
            size="sm"
            :icon="ICONS.player"
          >
            {{ player ? `${player.player_name} ${player.player_surname}` : t('deck.unknownPlayer') }}
            <span v-if="partnerName" class="text-muted ml-1">
              {{ t('commander.page.partnerSuffix', { name: partnerName }) }}
            </span>
            <span v-if="deck.is_borrowed" class="ml-1 text-warning">
              {{ t('deck.borrowedBadge') }}
            </span>
          </UButton>
        </div>
      </div>

      <ScryfallLinkButton :url="scryfallSearchUrl" />
    </div>

    <div v-else class="text-center py-12 text-muted">
      <UIcon :name="ICONS.noCommander" class="text-4xl mb-2 opacity-30" />
      <p>{{ t('commander.page.notFound') }}</p>
    </div>
  </div>
</template>
