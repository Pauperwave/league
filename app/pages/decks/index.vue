<!-- app\pages\decks\index.vue -->
<script setup lang="ts">
import type { CommanderCard } from '~/composables/commanders/useCommanderCards'
import type { CommanderDeck } from '#shared/utils/types'

const { t } = useI18n()

// Colada cache of all decks (ADR-015) — SSR-prefetched, shared across pages
const { data: decksData, isLoading: decksLoading } = useDecksQuery()
const allDecks = computed(() => decksData.value ?? [])

// Aggregate stats per commander from materialized view
const { data: commanderStatsList } = useAllCommanderStats()

// Sort state
const sortOptions = [
  { label: t('deck.sortOptions.alphabetical'), value: 'alphabetical', icon: ICONS.sortAlpha },
  { label: t('deck.sortOptions.popularity'), value: 'popularity', icon: ICONS.players },
  { label: t('deck.sortOptions.frequency'), value: 'frequency', icon: ICONS.battle },
  { label: t('deck.sortOptions.color'), value: 'color', icon: ICONS.palette },
  { label: t('deck.sortOptions.manaCost'), value: 'mana-cost', icon: ICONS.manaCost },
]

const selectedSort = ref('alphabetical')
const sortDirection = ref<'asc' | 'desc'>('asc')

// Toggle sort direction
function toggleDirection() {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
}

// Commander data for color / mana-cost sorting, fetched only once one of
// those sort modes is selected (Colada caches by the name set, ADR-015).
const uniqueCommanderNames = computed(() => [...new Set(allDecks.value.map((d: CommanderDeck) => d.commander_1_name))])
const needsCommanderData = computed(() => selectedSort.value === 'color' || selectedSort.value === 'mana-cost')
const { data: commanderCacheData, isLoading: commanderLoading } = useCommandersByNamesQuery(uniqueCommanderNames, needsCommanderData)
const commanderCache = computed(() => commanderCacheData.value ?? new Map<string, CommanderCard>())

function getDeckKey(deck: CommanderDeck): string {
  return `${deck.commander_1_name}|${deck.commander_2_name ?? ''}`
}

function getAggregate(deck: CommanderDeck) {
  const key = getDeckKey(deck)
  return commanderStatsList.value?.find(s =>
    `${s.commander_1}|${s.commander_2 ?? ''}` === key
  )
}

function getCommanderData(deck: CommanderDeck): CommanderCard | undefined {
  return commanderCache.value.get(deck.commander_1_name)
}

// ─── Sort comparators ─────────────────────────────────────────────────────────

function compareAlphabetical(a: CommanderDeck, b: CommanderDeck): number {
  return a.commander_1_name.localeCompare(b.commander_1_name)
}

function comparePopularity(a: CommanderDeck, b: CommanderDeck): number {
  const aggA = getAggregate(a)
  const aggB = getAggregate(b)
  return (aggA?.player_count ?? 0) - (aggB?.player_count ?? 0)
}

function compareFrequency(a: CommanderDeck, b: CommanderDeck): number {
  const aggA = getAggregate(a)
  const aggB = getAggregate(b)
  return (aggA?.match_count ?? 0) - (aggB?.match_count ?? 0)
}

// WUBRG order for color sorting
const colorOrder = ['W', 'U', 'B', 'R', 'G']

function colorSortKey(deck: CommanderDeck): string {
  const colors = getCommanderData(deck)?.colorIdentity ?? []
  if (colors.length === 0) return 'ZZZZ'
  const count = colors.length.toString().padStart(2, '0')
  const order = colors
    .sort((c1, c2) => colorOrder.indexOf(c1) - colorOrder.indexOf(c2))
    .join('')
  return `${count}${order}`
}

function compareColor(a: CommanderDeck, b: CommanderDeck): number {
  return colorSortKey(a).localeCompare(colorSortKey(b))
}

function compareManaCost(a: CommanderDeck, b: CommanderDeck): number {
  return (getCommanderData(a)?.cmc ?? 0) - (getCommanderData(b)?.cmc ?? 0)
}

const SORT_COMPARATORS: Record<string, (a: CommanderDeck, b: CommanderDeck) => number> = {
  alphabetical: compareAlphabetical,
  popularity: comparePopularity,
  frequency: compareFrequency,
  color: compareColor,
  'mana-cost': compareManaCost,
}

const sortedDecks = computed(() => {
  const decks = [...allDecks.value]
  const comparator = SORT_COMPARATORS[selectedSort.value] ?? compareAlphabetical
  const multiplier = sortDirection.value === 'asc' ? 1 : -1

  decks.sort((a, b) => comparator(a, b) * multiplier)
  return decks
})

// Enrich decks with player slugs for display
/** Deduplicate decks by commander identity — show each unique commander once */
const uniqueDecks = computed(() => {
  const seen = new Set<string>()
  const result: CommanderDeck[] = []

  for (const deck of sortedDecks.value) {
    const key = `${deck.commander_1_name}|${deck.commander_2_name ?? ''}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(deck)
    }
  }

  return result
})

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('deck.breadcrumb') }
])
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <PageHeaderRow :title="t('deck.breadcrumb')">
      <div class="flex items-center gap-2">
        <USelectMenu
          v-model="selectedSort"
          :items="sortOptions"
          value-key="value"
          label-key="label"
          icon-key="icon"
          :placeholder="t('player.toolbar.sortPlaceholder')"
          class="w-48"
        />
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          :icon="sortDirection === 'asc' ? ICONS.up : ICONS.down"
          @click="toggleDirection"
        />
      </div>
    </PageHeaderRow>

    <!-- Loading -->
    <div v-if="decksLoading || commanderLoading" class="flex items-center justify-center py-12">
      <UIcon :name="ICONS.loading" class="animate-spin text-3xl text-muted" />
    </div>

    <!-- Empty state -->
    <div v-else-if="uniqueDecks.length === 0" class="text-center py-12 text-muted">
      <UIcon :name="ICONS.battle" class="text-4xl mb-2 opacity-30" />
      <p>{{ t('deck.emptyList') }}</p>
    </div>

    <!-- Deck grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <CommanderDeckCard
        v-for="deck in uniqueDecks"
        :key="deck.id"
        :deck="deck"
        :aggregate="getAggregate(deck)"
      />
    </div>
  </div>
</template>
