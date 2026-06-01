<!-- app\components\Tables\EventTable.vue -->
<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { Component } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Event } from '#shared/utils/types'
import { sortableHeader, createActionsColumn, type StatusColor } from '~/composables/tables/useTableUtils'

defineProps<{
  events: Event[]
  loading?: boolean
}>()

const emit = defineEmits<{
  view: [event: Event]
  edit: [event: Event]
  delete: [event: Event]
}>()

const UBadge = resolveComponent('UBadge') as Component
const UButton = resolveComponent('UButton') as Component
const ActionButtons = resolveComponent('ActionButtons') as Component

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

const tableMeta = {
  class: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    header: sortableHeader('ID', UButton),
    meta: { class: { th: 'w-16', td: 'font-mono text-muted' } }
  },
  {
    accessorKey: 'event_name',
    header: sortableHeader('Nome', UButton),
    cell: ({ row }) => h('span', { class: 'font-semibold' }, row.getValue('event_name'))
  },
  {
    accessorKey: 'event_datetime',
    header: sortableHeader('Data', UButton),
    cell: ({ row }) => formatDate(row.getValue('event_datetime'))
  },
  {
    id: 'round',
    header: sortableHeader('Round', UButton),
    cell: ({ row }) => {
      const current = row.original.event_current_round
      const total = row.original.event_round_number
      return h('span', { class: 'font-mono' }, formatRound(current, total))
    }
  },
  {
    accessorKey: 'status',
    header: sortableHeader('Stato', UButton),
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
    header: sortableHeader('Registrazione', UButton),
    cell: ({ row }) => {
      const reg = getRegistrationStatus(row.original.event_registration_open)
      return h(UBadge, { color: reg.color, variant: 'subtle', icon: reg.icon }, () => reg.label)
    }
  },
  createActionsColumn<Event>(UButton, ActionButtons, {
    onView: (event) => emit('view', event),
    onEdit: (event) => emit('edit', event),
    onDelete: (event) => emit('delete', event),
  })
]
</script>

<template>
  <BaseTable
    :data="events"
    :columns="columns"
    :meta="tableMeta"
    :loading="loading"
    :sorting="[{ id: 'event_datetime', desc: false }]"
    empty-title="Nessun evento creato"
    empty-description="Clicca 'Nuovo Evento' per iniziare"
    empty-icon="i-lucide-calendar-x"
  />
</template>
