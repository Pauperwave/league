<!-- app\components\player\PlayersTable.vue -->
<script setup lang="ts">
import type { Component } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Player } from '#shared/utils/types'

const router = useRouter()

const props = defineProps<{
  players: Player[]
  getPlayerStat: (id: number, key: string) => number
  getDeckCount: (id: number) => number
}>()

const emit = defineEmits<{
  edit: [player: Player]
}>()

const { t } = useI18n()

const rowSelection = defineModel<Record<string, boolean>>('rowSelection', { default: () => ({}) })

const UButton = resolveComponent('UButton') as Component
const UCheckbox = resolveComponent('UCheckbox') as Component
const UBadge = resolveComponent('UBadge') as Component
const UAvatar = resolveComponent('UAvatar') as Component
const RowActionButtons = resolveComponent('RowActionButtons') as Component

function slugFor(player: Player) {
  return slugify(`${player.player_name ?? ''} ${player.player_surname ?? ''}`.trim())
}

function goToPlayer(player: Player) {
  router.push(`/player/${slugFor(player)}`)
}

// Every column is sortable by clicking its header (TanStack, via
// sortableHeader) — this replaced PlayersToolbar's separate sort
// dropdown/direction button (2026-07-19). Stat/deck columns use accessorFn
// (not accessorKey, since the value isn't a plain Player field) so TanStack
// has something to compare when sorting.
const statColumn = (
  id: string,
  label: string,
  statKey: string
): TableColumn<Player> => ({
  id,
  accessorFn: (row) => props.getPlayerStat(row.player_id, statKey),
  header: sortableHeader(label, UButton),
})

const columns: TableColumn<Player>[] = [
  createSelectionColumn<Player>(UCheckbox),
  {
    accessorKey: 'player_id',
    header: sortableHeader(t('player.table.id'), UButton),
    meta: { class: { th: 'w-16', td: 'font-mono text-muted' } }
  },
  {
    id: 'avatar',
    header: '',
    enableSorting: false,
    meta: { class: { th: 'w-10', td: 'w-10' } },
    cell: ({ row }) => h(UAvatar, {
      size: 'sm',
      src: generatePlayerAvatar(row.original.player_id),
      alt: row.original.player_name ?? undefined
    })
  },
  {
    accessorKey: 'player_name',
    header: sortableHeader(t('player.table.name'), UButton),
    cell: ({ row }) => h(
      resolveComponent('NuxtLink') as Component,
      { to: `/player/${slugFor(row.original)}`, class: 'font-bold' },
      () => row.original.player_name
    )
  },
  {
    accessorKey: 'player_surname',
    header: sortableHeader(t('player.table.surname'), UButton),
    cell: ({ row }) => h('span', { class: 'font-bold text-primary' }, row.original.player_surname)
  },
  {
    id: 'decks',
    accessorFn: (row) => props.getDeckCount(row.player_id),
    header: sortableHeader(t('player.table.decks'), UButton)
  },
  statColumn('events', t('player.table.events'), 'events_played'),
  statColumn('matches', t('player.table.matches'), 'total_matches'),
  statColumn('wins', t('player.table.wins'), 'total_wins'),
  statColumn('kills', t('player.table.kills'), 'total_kills'),
  {
    ...statColumn('avgScore', t('player.table.avgScore'), 'average_score'),
    cell: ({ row }) => (row.getValue('avgScore') as number).toFixed(2)
  },
  {
    accessorKey: 'formats_played',
    header: t('player.table.formats'),
    enableSorting: false,
    cell: ({ row }) => (row.original.formats_played ?? []).length === 0
      ? ''
      : h('div', { class: 'flex flex-wrap gap-1' }, (row.original.formats_played ?? []).map(
        (format) => h(UBadge, { key: format, color: 'neutral', variant: 'subtle', size: 'sm' }, () => format)
      ))
  },
  {
    accessorKey: 'is_active',
    header: sortableHeader(t('player.table.active'), UButton),
    cell: ({ row }) => h(
      UBadge,
      { color: row.original.is_active ? 'success' : 'neutral', variant: 'subtle' },
      () => t(row.original.is_active ? 'player.status.active' : 'player.status.inactive')
    )
  },
  {
    id: 'actions',
    header: t('player.table.actions'),
    enableSorting: false,
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) => h(RowActionButtons, {
      showEdit: true,
      showView: false,
      showDelete: false,
      size: 'sm',
      variant: 'outline',
      onEdit: () => emit('edit', row.original),
    })
  }
]
</script>

<template>
  <BaseTable
    v-model:row-selection="rowSelection"
    :data="players"
    :columns="columns"
    :get-row-id="(row) => String(row.player_id)"
    :sorting="[{ id: 'player_name', desc: false }]"
    :on-row-click="goToPlayer"
    :empty-title="t('player.emptyState.noPlayersTitle')"
    :empty-description="t('player.emptyState.noPlayersDescription')"
    :empty-icon="ICONS.players"
  />
</template>
