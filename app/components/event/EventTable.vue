<!-- app\components\Tables\EventTable.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { h, resolveComponent } from 'vue'
import type { Component } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Event } from '#shared/utils/types'
import { sortableHeader, createActionsColumn, type StatusColor } from '~/composables/tables/useTableUtils'

const { t } = useI18n()

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

function getEventStatus(event: Event): { key: 'ended' | 'playing' | 'registration', label: string, color: StatusColor, icon: string } {
  if ((event.event_current_round || 0) > (event.event_round_number || 0)) {
    return { key: 'ended', label: t('event.status.ended'), color: 'error', icon: ICONS.clear }
  }
  if (event.event_playing) {
    return { key: 'playing', label: t('event.status.playing'), color: 'success', icon: ICONS.success }
  }
  return { key: 'registration', label: t('event.status.registration'), color: 'warning', icon: ICONS.clock }
}

function getRegistrationStatus(open: boolean | null): {
  label: string
  color: StatusColor
  icon: string
} {
  if (open) {
    return { label: t('event.table.registrationOpen'), color: 'success', icon: ICONS.success }
  }
  return { label: t('event.table.registrationClosed'), color: 'error', icon: ICONS.clear }
}

function formatRound(current: number | null, total: number | null): string {
  return `${current || 0}/${total || 0}`
}

const tableMeta = {
  class: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tr: (row: any) => {
      const status = getEventStatus(row.original)
      if (status.key === 'playing') return 'bg-success/10'
      if (status.key === 'ended') return 'bg-error/10'
      return 'bg-info/10'
    }
  }
}

const columns: TableColumn<Event>[] = [
  {
    accessorKey: 'event_id',
    header: sortableHeader(t('league.table.id'), UButton),
    meta: { class: { th: 'w-16', td: 'font-mono text-muted' } }
  },
  {
    accessorKey: 'event_name',
    header: sortableHeader(t('league.table.name'), UButton),
    cell: ({ row }) => h('span', { class: 'font-semibold' }, row.getValue('event_name'))
  },
  {
    accessorKey: 'event_datetime',
    header: sortableHeader(t('event.table.date'), UButton),
    cell: ({ row }) => formatDate(row.getValue('event_datetime'))
  },
  {
    id: 'round',
    header: sortableHeader(t('event.table.round'), UButton),
    cell: ({ row }) => {
      const current = row.original.event_current_round
      const total = row.original.event_round_number
      return h('span', { class: 'font-mono' }, formatRound(current, total))
    }
  },
  {
    accessorKey: 'status',
    header: sortableHeader(t('event.table.status'), UButton),
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
    header: sortableHeader(t('event.table.registration'), UButton),
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
    :empty-title="t('event.table.emptyTitle')"
    :empty-description="t('event.table.emptyDescription')"
    :empty-icon="ICONS.calendarCancel"
  />
</template>
