<!-- app\components\tournament\TournamentsTable.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- id/name column boilerplate shared with LeagueTable.vue; kept inline rather than
// extracted into useTableUtils.ts so each table's column list stays fully readable in one place
import type { Component } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Tournament } from '#shared/utils/types'
import type { StatusColor } from '~/composables/tables/useTableUtils'

const { t } = useI18n()

defineProps<{
  events: Tournament[]
  loading?: boolean
}>()

const emit = defineEmits<{
  view: [tournament: Tournament]
  edit: [tournament: Tournament]
  delete: [tournament: Tournament]
}>()

const UBadge = resolveComponent('UBadge') as Component
const UButton = resolveComponent('UButton') as Component
const RowActionButtons = resolveComponent('RowActionButtons') as Component

function getEventStatus(event: Tournament): { key: 'ended' | 'playing' | 'registration', label: string, color: StatusColor, icon: string } {
  if ((event.tournament_current_round || 0) > (event.tournament_round_number || 0)) {
    return { key: 'ended', label: t('tournament.status.ended'), color: 'error', icon: ICONS.clear }
  }
  if (event.tournament_playing) {
    return { key: 'playing', label: t('tournament.status.playing'), color: 'success', icon: ICONS.success }
  }
  return { key: 'registration', label: t('tournament.status.registration'), color: 'warning', icon: ICONS.clock }
}

function getRegistrationStatus(open: boolean | null): {
  label: string
  color: StatusColor
  icon: string
} {
  if (open) {
    return { label: t('tournament.table.registrationOpen'), color: 'success', icon: ICONS.success }
  }
  return { label: t('tournament.table.registrationClosed'), color: 'error', icon: ICONS.clear }
}

// tournament_current_round is set to tournament_round_number + 1 as the internal
// "ended" sentinel (see useTournamentStore's isTournamentEnded/getEventStatus above) —
// clamp it for display so a finished tournament reads "2/2", not "3/2".
function formatRound(current: number | null, total: number | null): string {
  const safeTotal = total || 0
  const safeCurrent = Math.min(current || 0, safeTotal)
  return `${safeCurrent}/${safeTotal}`
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

const columns: TableColumn<Tournament>[] = [
  {
    accessorKey: 'tournament_id',
    header: sortableHeader(t('league.table.id'), UButton),
    meta: { class: { th: 'w-16', td: 'font-mono text-muted' } }
  },
  {
    accessorKey: 'tournament_name',
    header: sortableHeader(t('league.table.name'), UButton),
    cell: ({ row }) => h('span', { class: 'font-semibold' }, row.getValue('tournament_name'))
  },
  {
    accessorKey: 'tournament_datetime',
    header: sortableHeader(t('tournament.table.date'), UButton),
    cell: ({ row }) => formatDate(row.getValue('tournament_datetime'))
  },
  {
    id: 'round',
    header: sortableHeader(t('tournament.table.round'), UButton),
    cell: ({ row }) => {
      const current = row.original.tournament_current_round
      const total = row.original.tournament_round_number
      return h('span', { class: 'font-mono' }, formatRound(current, total))
    }
  },
  {
    accessorKey: 'status',
    header: sortableHeader(t('tournament.table.status'), UButton),
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
    header: sortableHeader(t('tournament.table.registration'), UButton),
    cell: ({ row }) => {
      const reg = getRegistrationStatus(row.original.tournament_registration_open)
      return h(UBadge, { color: reg.color, variant: 'subtle', icon: reg.icon }, () => reg.label)
    }
  },
  createActionsColumn<Tournament>(UButton, RowActionButtons, {
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
    :sorting="[{ id: 'tournament_datetime', desc: false }]"
    :empty-title="t('tournament.table.emptyTitle')"
    :empty-description="t('tournament.table.emptyDescription')"
    :empty-icon="ICONS.calendarCancel"
  />
</template>
