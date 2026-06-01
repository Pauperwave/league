<!-- app\components\Tables\LeagueTable.vue -->
<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { Component } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { League, Ruleset } from '#shared/utils/types'
import { sortableHeader, createActionsColumn, type StatusColor } from '~/composables/tables/useTableUtils'

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
const ActionButtons = resolveComponent('ActionButtons') as Component

const statusConfig: Record<string, { color: StatusColor, icon: string }> = {
  Programmata: { color: 'info', icon: 'i-lucide-clock' },
  Attiva: { color: 'success', icon: 'i-lucide-circle-check' },
  Terminata: { color: 'neutral', icon: 'i-lucide-circle-x' }
}

function getStatusConfig(status: string) {
  return statusConfig[status] ?? { color: 'neutral' as StatusColor, icon: 'i-lucide-circle-help' }
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
    header: sortableHeader('ID', UButton),
    meta: { class: { th: 'w-16', td: 'font-mono text-muted' } }
  },
  {
    accessorKey: 'name',
    header: sortableHeader('Nome', UButton),
    cell: ({ row }) => h('span', { class: 'font-semibold' }, row.getValue('name'))
  },
  {
    accessorKey: 'starts_at',
    header: sortableHeader('Inizio', UButton),
    cell: ({ row }) => formatDate(row.getValue('starts_at'))
  },
  {
    accessorKey: 'ends_at',
    header: sortableHeader('Fine', UButton),
    cell: ({ row }) => formatDate(row.getValue('ends_at'))
  },
  {
    accessorKey: 'status',
    header: sortableHeader('Status', UButton),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const { color, icon } = getStatusConfig(status)
      return h(UBadge, { color, variant: 'subtle', icon }, () => status)
    }
  },
  {
    id: 'ruleset',
    header: 'Regolamento',
    enableSorting: false,
    cell: ({ row }) => {
      const rulesetId = row.original.ruleset_id
      const ruleset = props.rulesets.find(r => r.ruleset_id === rulesetId)
      return ruleset?.name || 'Standard'
    }
  },
  createActionsColumn<League>(UButton, ActionButtons, {
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
    empty-title="Nessuna lega creata"
    empty-description="Clicca 'Nuova Lega' per iniziare"
    empty-icon="i-lucide-trophy"
  />
</template>
