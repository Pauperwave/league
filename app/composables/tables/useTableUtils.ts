// app\composables\tables\useTableUtils.ts
import type { TableColumn } from '@nuxt/ui'
import type { CalendarDate } from '@internationalized/date'
import { parseDate, today, getLocalTimeZone } from '@internationalized/date'
import type { Component } from 'vue'
import type { PaymentMethod } from '#shared/utils/types'

export type StatusColor = 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'primary' | 'secondary'

/** Shared by TournamentRegistrationTable and the payments overview page —
 * `unknownLabel` is passed in rather than resolved here since this is a
 * plain module function, not a component `setup()` (can't call useI18n()). */
export function formatRegisteredAt(iso: string | null, unknownLabel: string): string {
  if (!iso) return unknownLabel
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

/** The player-name-tag cell renderer shared by TournamentRegistrationTable
 * and the payments overview page's "name" column. */
export function playerNameCell(
  PlayerNameTag: Component,
  row: { name: string, surname: string, playerId: number }
) {
  return h(PlayerNameTag, {
    name: row.name,
    surname: row.surname,
    playerId: row.playerId,
    avatarSize: 'md',
  })
}

/** The payment-method badge (or "unknown" fallback) cell renderer shared by
 * TournamentRegistrationTable and the payments overview page's "paymentMethod"
 * column. `onClick` is only passed by the payments page, whose badges
 * double as quick filters. */
export function paymentMethodCell(
  UBadge: Component,
  method: PaymentMethod | null,
  unknownLabel: string,
  t: (key: string) => string,
  onClick?: () => void
) {
  if (!method) {
    return h('span', { class: 'text-muted text-sm' }, unknownLabel)
  }
  const display = PAYMENT_METHOD_DISPLAY[method]
  return h(UBadge, {
    label: t(display.labelKey),
    icon: display.icon,
    color: display.color,
    variant: 'subtle',
    ...(onClick ? { class: 'cursor-pointer hover:brightness-110', onClick } : {}),
  })
}

export function formatDate(date: string | null): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('it-IT')
}

export function formatWeekday(date: string | null): string {
  if (!date) return 'N/A'
  const label = new Date(date).toLocaleDateString('it-IT', { weekday: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
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

export function createSelectionColumn<T>(UCheckbox: Component): TableColumn<T> {
  return {
    id: 'select',
    header: ({ table }) => h(UCheckbox, {
      modelValue: table.getIsAllPageRowsSelected()
        ? true
        : table.getIsSomePageRowsSelected() ? 'indeterminate' : false,
      'onUpdate:modelValue': (value: boolean) => table.toggleAllPageRowsSelected(!!value),
      'aria-label': 'Seleziona tutti'
    }),
    cell: ({ row }) => h(UCheckbox, {
      modelValue: row.getIsSelected(),
      'onUpdate:modelValue': (value: boolean) => row.toggleSelected(!!value),
      'aria-label': 'Seleziona riga'
    }),
    enableSorting: false,
    meta: { class: { th: 'w-10', td: 'w-10' } }
  }
}

export function createActionsColumn<T>(
  UButton: Component,
  RowActionButtons: Component,
  handlers: {
    onView: (item: T) => void
    onEdit: (item: T) => void
    onDelete: (item: T) => void
  },
  /** Row's display name for the action log (e.g. league/tournament name) — see
   * RowActionButtons.vue's entityLabel prop. */
  getEntityLabel?: (item: T) => string
): TableColumn<T> {
  return {
    id: 'actions',
    header: 'Azioni',
    enableSorting: false,
    meta: { class: { td: 'text-right' } },
    cell: ({ row }) =>
      h(RowActionButtons, {
        showView: true,
        showEdit: true,
        showDelete: true,
        size: 'sm',
        variant: 'outline',
        entityLabel: getEntityLabel?.(row.original),
        onEdit: () => handlers.onEdit(row.original),
        onView: () => handlers.onView(row.original),
        onDelete: () => handlers.onDelete(row.original),
      })
  }
}
