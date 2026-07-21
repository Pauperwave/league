<!-- app\pages\commanders\index.vue -->
<script setup lang="ts">
import type { Component } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import ManaCost from '~/components/commander/ManaCost.vue'

const { t } = useI18n()

// Colada cache of commander_stats (ADR-015) — same source as the detail
// page's aggregation, just listing every distinct name instead of summing one.
const { data: commanderStatsList, pending: statsLoading } = useAllCommanderStats()
// Commander catalog (mana cost, ADR-016) — same cache CommanderModal/search use.
const { data: catalogData, isLoading: catalogLoading } = useCommanderCatalogQuery()

// Only the (small, fast) commander_stats query gates the page — the ~800KB
// commander catalog (needed just for the mana-cost column) loads in the
// background, with a USkeleton shown per-cell in the meantime (see manaCost
// column below), so the table isn't blocked on the heaviest payload.
const isLoading = statsLoading

const allNames = computed(() => getAllCommanderNames(commanderStatsList.value ?? []))

const catalogByName = computed(() => new Map((catalogData.value ?? []).map(row => [row.name, row])))

interface CommanderRow {
  name: string
  manaCost: string | null
  playerCount: number
  matchCount: number
  winCount: number
  totalKills: number
  averageScore: number
}

const allRows = computed<CommanderRow[]>(() => {
  const stats = commanderStatsList.value ?? []
  return allNames.value.map((name) => {
    const agg = aggregateSingleCommander(stats, name)
    return {
      name,
      manaCost: catalogByName.value.get(name)?.manaCost ?? null,
      playerCount: agg?.playerCount ?? 0,
      matchCount: agg?.matchCount ?? 0,
      winCount: agg?.winCount ?? 0,
      totalKills: agg?.totalKills ?? 0,
      averageScore: agg?.averageScore ?? 0,
    }
  })
})

const searchQuery = ref('')

const filteredRows = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return allRows.value
  return allRows.value.filter(row => row.name.toLowerCase().includes(query))
})

const UButton = resolveComponent('UButton') as Component

// Every column sorts by clicking its header (TanStack, via sortableHeader —
// same pattern as PlayersTable.vue/LeagueTable.vue).
const statColumn = (
  accessorKey: keyof CommanderRow,
  label: string,
  color = ''
): TableColumn<CommanderRow> => ({
  accessorKey,
  header: sortableHeader(label, UButton),
  cell: ({ getValue }) => {
    const value = getValue() as number
    return h('span', { class: color }, accessorKey === 'averageScore' ? value.toFixed(1) : String(value))
  },
  meta: { class: { th: 'text-center', td: 'text-center px-3 py-1.5' } },
})

const columns: TableColumn<CommanderRow>[] = [
  {
    accessorKey: 'manaCost',
    header: t('deck.sortOptions.manaCost'),
    enableSorting: false,
    cell: ({ row }) =>
      catalogLoading.value
        ? h(resolveComponent('USkeleton') as Component, { class: 'h-4 w-16' })
        : h(ManaCost, { manaCost: row.original.manaCost, size: 'sm' }),
    meta: { class: { td: 'px-3 py-1.5 w-32' } },
  },
  {
    accessorKey: 'name',
    header: sortableHeader(t('commander.index.nameColumn'), UButton),
    cell: ({ row }) =>
      h(
        resolveComponent('NuxtLink'),
        { to: `/commander/${slugify(row.original.name)}`, class: 'text-primary hover:underline font-medium' },
        () => row.original.name
      ),
  },
  statColumn('playerCount', t('deck.statsPlayers')),
  statColumn('matchCount', t('player.stats.matches')),
  statColumn('winCount', t('player.stats.wins'), 'text-warning'),
  statColumn('totalKills', t('player.stats.kills'), 'text-error'),
  statColumn('averageScore', t('player.stats.average'), 'text-success'),
]

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('commander.index.breadcrumb') }
])
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <UBreadcrumb :items="breadcrumbItems" />

    <PageHeaderRow :title="t('commander.index.breadcrumb')">
      <UInput
        v-model="searchQuery"
        :icon="ICONS.search"
        :placeholder="t('commander.index.searchPlaceholder')"
        class="w-64"
      />
    </PageHeaderRow>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <UIcon :name="ICONS.loading" class="animate-spin text-3xl text-muted" />
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredRows.length === 0" class="text-center py-12 text-muted">
      <UIcon :name="ICONS.battle" class="text-4xl mb-2 opacity-30" />
      <p>{{ t('commander.index.emptyList') }}</p>
    </div>

    <!-- Commander table -->
    <BaseTable
      v-else
      :data="filteredRows"
      :columns="columns"
      :sorting="[{ id: 'name', desc: false }]"
      :empty-title="t('commander.index.emptyList')"
      :empty-description="t('commander.index.searchPlaceholder')"
      :empty-icon="ICONS.battle"
    />
  </div>
</template>
