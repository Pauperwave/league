<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { League, Ruleset } from '#shared/utils/types'
import { formatDate } from '~/composables/useTableUtils'

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

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

type StatusColor = 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'primary' | 'secondary'

const statusConfig: Record<string, { color: StatusColor, icon: string }> = {
  Programmata: { color: 'info', icon: 'i-lucide-clock' },
  Attiva: { color: 'success', icon: 'i-lucide-circle-check' },
  Terminata: { color: 'neutral', icon: 'i-lucide-circle-x' }
}

function getStatusConfig(status: string) {
  return statusConfig[status] ?? { color: 'neutral' as StatusColor, icon: 'i-lucide-circle-help' }
}

function sortableHeader(label: string) {
  return ({ column }: { column: any }) => {
    const isSorted = column.getIsSorted()
    return h(UButton, {
      color: 'neutral',
      variant: 'ghost',
      label,
      icon: isSorted
        ? isSorted === 'asc'
          ? 'i-lucide-arrow-up-narrow-wide'
          : 'i-lucide-arrow-down-wide-narrow'
        : 'i-lucide-arrow-up-down',
      class: '-mx-2.5',
      onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
    })
  }
}

const tableMeta = {
  class: {
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
    header: sortableHeader('ID'),
    meta: { class: { th: 'w-16', td: 'font-mono text-muted' } }
  },
  {
    accessorKey: 'name',
    header: sortableHeader('Nome'),
    cell: ({ row }) => h('span', { class: 'font-semibold' }, row.getValue('name'))
  },
  {
    accessorKey: 'starts_at',
    header: sortableHeader('Inizio'),
    cell: ({ row }) => formatDate(row.getValue('starts_at'))
  },
  {
    accessorKey: 'ends_at',
    header: sortableHeader('Fine'),
    cell: ({ row }) => formatDate(row.getValue('ends_at'))
  },
  {
    accessorKey: 'status',
    header: sortableHeader('Status'),
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
  {
    id: 'actions',
    header: 'Azioni',
    enableSorting: false,
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) =>
      h('div', { class: 'flex gap-2 justify-end' }, [
        h(UButton, {
          'icon': 'i-lucide-pencil',
          'variant': 'outline',
          'color': 'neutral',
          'size': 'sm',
          'aria-label': 'Modifica',
          'onClick': (e: Event) => {
            e.stopPropagation()
            emit('edit', row.original)
          }
        }),
        h(UButton, {
          'icon': 'i-lucide-eye',
          'variant': 'outline',
          'color': 'neutral',
          'size': 'sm',
          'aria-label': 'Visualizza',
          'onClick': (e: Event) => {
            e.stopPropagation()
            emit('view', row.original)
          }
        }),
        h(UButton, {
          'icon': 'i-lucide-trash-2',
          'variant': 'outline',
          'color': 'error',
          'size': 'sm',
          'aria-label': 'Elimina',
          'onClick': (e: Event) => {
            e.stopPropagation()
            emit('delete', row.original)
          }
        })
      ])
  }
]
</script>

<template>
  <UTable
    :data="leagues"
    :columns="columns"
    :meta="tableMeta"
    :loading="loading"
    :sorting="[{ id: 'starts_at', desc: false }]"
    class="w-full"
    :ui="{
      root: 'border border-default',
      th: 'border-b border-default',
      td: 'border-b border-default'
    }"
  >
    <template #loading>
      <div class="flex items-center justify-center py-12">
        <UIcon
          name="i-lucide-loader-2"
          class="animate-spin text-4xl text-primary"
        />
      </div>
    </template>

    <template #empty>
      <LazyUEmpty
        title="Nessuna lega creata"
        description="Clicca 'Nuova Lega' per iniziare"
        icon="i-lucide-trophy"
      />
    </template>
  </UTable>
</template>
