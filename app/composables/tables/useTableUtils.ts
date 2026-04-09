import { h, resolveComponent } from 'vue'
import type { CalendarDate} from '@internationalized/date'
import { parseDate, today, getLocalTimeZone } from '@internationalized/date'

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

type SortDirection = 'asc' | 'desc' | false

interface SortableColumn {
  getIsSorted: () => SortDirection
  toggleSorting: () => void
}

export function sortableHeader(label: string) {
  return ({ column }: { column: SortableColumn }) => {
    const isSorted = column.getIsSorted()
    const UIcon = resolveComponent('UIcon')

    return h(
      'button',
      {
        type: 'button',
        class: 'flex items-center gap-1 text-left cursor-pointer hover:text-primary transition-colors',
        onClick: (e: Event) => {
          e.preventDefault()
          column.toggleSorting()
        },
      },
      [
        h('span', { class: 'font-medium text-foreground' }, label),
        h(UIcon, {
          name: 'i-lucide-chevron-down',
          class: [
            'size-3.5 shrink-0 transition-transform',
            isSorted === 'asc' ? 'rotate-180' : '',
            isSorted ? 'text-primary' : 'text-muted opacity-50',
          ],
        }),
      ]
    )
  }
}
