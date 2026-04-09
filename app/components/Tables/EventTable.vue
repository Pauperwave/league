<!-- app\components\Tables\EventTable.vue -->
<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Event } from '#shared/utils/types'

defineProps<{
  events: Event[]
  loading?: boolean
}>()

const emit = defineEmits<{
  view: [event: Event]
  edit: [event: Event]
  delete: [event: Event]
}>()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')

type StatusColor = 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'primary' | 'secondary'

function getEventStatus(event: Event): { label: string, color: StatusColor, icon: string } {
  if ((event.event_current_round || 0) > (event.event_round_number || 0)) {
    return { label: 'Terminato', color: 'error', icon: 'i-lucide-circle-x' }
  }
  if (event.event_playing) {
    return { label: 'In Corso', color: 'success', icon: 'i-lucide-circle-check' }
  }
  return { label: 'Programmato', color: 'warning', icon: 'i-lucide-clock' }
}

function getRegistrationStatus(open: boolean | null): {
  label: string
  color: StatusColor
  icon: string
} {
  if (open) {
    return { label: 'Aperta', color: 'success', icon: 'i-lucide-circle-check' }
  }
  return { label: 'Chiusa', color: 'error', icon: 'i-lucide-circle-x' }
}

function formatRound(current: number | null, total: number | null): string {
  return `${current || 0}/${total || 0}`
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
      const status = getEventStatus(row.original)
      if (status.label === 'In Corso') return 'bg-success/10'
      if (status.label === 'Terminato') return 'bg-error/10'
      return 'bg-info/10'
    }
  }
}

const columns: TableColumn<Event>[] = [
  {
    accessorKey: 'event_id',
    header: sortableHeader('ID'),
    meta: { class: { th: 'w-16', td: 'font-mono text-muted' } }
  },
  {
    accessorKey: 'event_name',
    header: sortableHeader('Nome'),
    cell: ({ row }) => h('span', { class: 'font-semibold' }, row.getValue('event_name'))
  },
  {
    accessorKey: 'event_datetime',
    header: sortableHeader('Data'),
    cell: ({ row }) => formatDate(row.getValue('event_datetime'))
  },
  {
    id: 'round',
    header: sortableHeader('Round'),
    cell: ({ row }) => {
      const current = row.original.event_current_round
      const total = row.original.event_round_number
      return h('span', { class: 'font-mono' }, formatRound(current, total))
    }
  },
  {
    accessorKey: 'status',
    header: sortableHeader('Stato'),
    cell: ({ row }) => {
      const status = getEventStatus(row.original)
      return h(
        UBadge,
        { color: status.color, variant: 'subtle', icon: status.icon },
        () => status.label
      )
    }
  },
  {
    id: 'registration',
    header: sortableHeader('Registrazione'),
    cell: ({ row }) => {
      const reg = getRegistrationStatus(row.original.event_registration_open)
      return h(UBadge, { color: reg.color, variant: 'subtle', icon: reg.icon }, () => reg.label)
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
          'onClick': (e: MouseEvent) => {
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
          'onClick': (e: MouseEvent) => {
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
          'onClick': (e: MouseEvent) => {
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
    :data="events"
    :columns="columns"
    :meta="tableMeta"
    :loading="loading"
    :sorting="[{ id: 'event_datetime', desc: false }]"
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
        title="Nessun evento creato"
        description="Clicca 'Nuovo Evento' per iniziare"
        icon="i-lucide-calendar-x"
      />
    </template>
  </UTable>
</template>
