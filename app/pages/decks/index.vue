<!-- app\pages\decks\index.vue -->
<script setup lang="ts">
import {
  fetchCommandersByNames,
  type CommanderCard,
} from '~/composables/commanders/useCommanderCards'
import { useAllCommanderStats } from '~/composables/supabase/useCommanderStats'
import type { CommanderDeck } from '#shared/utils/types'

const commanderDecksStore = useCommanderDeckStore()

// Fetch all decks
onMounted(() => {
  commanderDecksStore.fetchDecks()
})

// Aggregate stats per commander from materialized view
const { data: commanderStatsList } = useAllCommanderStats()

// Commander data for color / mana cost sorting (fetched lazily from DB)
const commanderCache = ref(new Map<string, CommanderCard>())
const commanderLoading = ref(false)

// Sort state
const sortOptions = [
  { label: 'Alfabetico', value: 'alphabetical', icon: 'i-lucide-arrow-up-a-z' },
  { label: 'Popolarita', value: 'popularity', icon: 'i-lucide-users' },
  { label: 'Frequenza', value: 'frequency', icon: 'i-lucide-swords' },
  { label: 'Colore', value: 'color', icon: 'i-lucide-palette' },
  { label: 'Costo mana', value: 'mana-cost', icon: 'i-lucide-hash' },
]

const selectedSort = ref('alphabetical')
const sortDirection = ref<'asc' | 'desc'>('asc')

// Toggle sort direction
function toggleDirection() {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
}

// Fetch commander data when color or mana-cost sort is selected
watch(selectedSort, async (newSort) => {
  if ((newSort === 'color' || newSort === 'mana-cost') && commanderCache.value.size === 0) {
    const uniqueCommanders: string[] = [...new Set(commanderDecksStore.decks.map((d: CommanderDeck) => d.commander_1_name))]
    if (uniqueCommanders.length > 0) {
      commanderLoading.value = true
      const supabase = useSupabaseClient()
      const cards = await fetchCommandersByNames(uniqueCommanders, supabase)
      commanderCache.value = cards
      commanderLoading.value = false
    }
  }
})

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
  const decks = [...commanderDecksStore.decks]
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

const breadcrumbItems = [
  { label: 'Home', to: '/' },
  { label: 'Deck' }
]
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <!-- Header -->
    <div class="flex items-center justify-between">
      <UButton color="neutral" icon="i-lucide-arrow-left" to="/">
        Home
      </UButton>
      <h1 class="text-2xl font-bold">
        Deck
      </h1>
      <div class="flex items-center gap-2">
        <USelectMenu
          v-model="selectedSort"
          :items="sortOptions"
          value-key="value"
          label-key="label"
          icon-key="icon"
          placeholder="Ordina per..."
          class="w-48"
        />
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          :icon="sortDirection === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
          @click="toggleDirection"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="commanderDecksStore.loading || commanderLoading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-muted" />
    </div>

    <!-- Empty state -->
    <div v-else-if="uniqueDecks.length === 0" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-swords" class="text-4xl mb-2 opacity-30" />
      <p>Nessun deck trovato</p>
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
