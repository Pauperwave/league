import type { TableColumn } from '@nuxt/ui'
import { ICONS } from '~/utils/icons'
import type { CalendarDate } from '@internationalized/date'
import { parseDate, today, getLocalTimeZone } from '@internationalized/date'
import { h } from 'vue'
import type { Component } from 'vue'

export type StatusColor = 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'primary' | 'secondary'

export function formatDate(date: string | null): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('it-IT')
}

export function getToday(): CalendarDate {
  return today(getLocalTimeZone())
}

export function parseDateString(dateStr: string | null): CalendarDate | null {
  if (!dateStr) return null
  try {
    const datePart = dateStr.split('T')[0]
    return datePart ? parseDate(datePart) : null
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SortableColumn = any

export function sortableHeader(label: string, UButton: Component) {
  return ({ column }: { column: SortableColumn }) => {
    const isSorted = column.getIsSorted()
    return h(UButton, {
      color: 'neutral',
      variant: 'ghost',
      label,
      icon: isSorted
        ? isSorted === 'asc'
          ? ICONS.sortAscNumeric
          : ICONS.sortDescNumeric
        : ICONS.sortBoth,
      class: '-mx-2.5',
      onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
    })
  }
}

export function createActionsColumn<T>(
  UButton: Component,
  ActionButtons: Component,
  handlers: {
    onView: (item: T) => void
    onEdit: (item: T) => void
    onDelete: (item: T) => void
  }
): TableColumn<T> {
  return {
    id: 'actions',
    header: 'Azioni',
    enableSorting: false,
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) =>
      h(ActionButtons, {
        showView: true,
        showEdit: true,
        showDelete: true,
        size: 'sm',
        variant: 'outline',
        onEdit: () => handlers.onEdit(row.original),
        onView: () => handlers.onView(row.original),
        onDelete: () => handlers.onDelete(row.original),
      })
  }
}
