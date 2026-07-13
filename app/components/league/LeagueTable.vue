<!-- app\components\Tables\LeagueTable.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
import { h, resolveComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Component } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { League, Ruleset } from '#shared/utils/types'
import { sortableHeader, createActionsColumn, type StatusColor } from '~/composables/tables/useTableUtils'

const { t } = useI18n()

const props = defineProps<{
  leagues: League[]
  rulesets: Ruleset[]
  loading?: boolean
}>()

const emit = defineEmits<{
  view: [league: League]
  edit: [league: League]
  delete: [league: League]
}>()

const UBadge = resolveComponent('UBadge') as Component
const UButton = resolveComponent('UButton') as Component
const RowActionButtons = resolveComponent('RowActionButtons') as Component

const statusConfig: Record<string, { color: StatusColor, icon: string, labelKey: string }> = {
  Programmata: { color: 'info', icon: ICONS.clock, labelKey: 'league.status.scheduled' },
  Attiva: { color: 'success', icon: ICONS.success, labelKey: 'league.status.active' },
  Terminata: { color: 'neutral', icon: ICONS.clear, labelKey: 'league.status.ended' }
}

function getStatusConfig(status: string): { color: StatusColor, icon: string, labelKey: string | null } {
  return statusConfig[status] ?? { color: 'neutral', icon: ICONS.help, labelKey: null }
}

const tableMeta = {
  class: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tr: (row: any) => {
      const status = row.original.status
      if (status === 'Attiva') return 'bg-success/10'
      if (status === 'Programmata') return 'bg-info/10'
      if (status === 'Terminata') return 'bg-neutral/10'
      return ''
    }
  }
}

const columns: TableColumn<League>[] = [
  {
    accessorKey: 'id',
    header: sortableHeader(t('league.table.id'), UButton),
    meta: { class: { th: 'w-16', td: 'font-mono text-muted' } }
  },
  {
    accessorKey: 'name',
    header: sortableHeader(t('league.table.name'), UButton),
    cell: ({ row }) => h('span', { class: 'font-semibold' }, row.getValue('name'))
  },
  {
    accessorKey: 'starts_at',
    header: sortableHeader(t('league.table.starts'), UButton),
    cell: ({ row }) => formatDate(row.getValue('starts_at'))
  },
  {
    accessorKey: 'ends_at',
    header: sortableHeader(t('league.table.ends'), UButton),
    cell: ({ row }) => formatDate(row.getValue('ends_at'))
  },
  {
    accessorKey: 'status',
    header: sortableHeader(t('league.table.status'), UButton),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const { color, icon, labelKey } = getStatusConfig(status)
      return h(UBadge, { color, variant: 'subtle', icon }, () => labelKey ? t(labelKey) : status)
    }
  },
  {
    id: 'ruleset',
    header: t('league.table.ruleset'),
    enableSorting: false,
    cell: ({ row }) => {
      const rulesetId = row.original.ruleset_id
      const ruleset = props.rulesets.find(r => r.ruleset_id === rulesetId)
      return ruleset?.name || t('league.table.rulesetFallback')
    }
  },
  createActionsColumn<League>(UButton, RowActionButtons, {
    onView: (league) => emit('view', league),
    onEdit: (league) => emit('edit', league),
    onDelete: (league) => emit('delete', league),
  })
]
</script>

<template>
  <BaseTable
    :data="leagues"
    :columns="columns"
    :meta="tableMeta"
    :loading="loading"
    :sorting="[{ id: 'starts_at', desc: false }]"
    :empty-title="t('league.emptyTitle')"
    :empty-description="t('league.emptyDescription')"
    :empty-icon="ICONS.standings"
  />
</template>
