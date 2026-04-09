import { h } from 'vue'
import { CalendarDate, parseDate } from '@internationalized/date'

export type StatusColor = 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'primary' | 'secondary'

export function formatDate(date: string | null): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('it-IT')
}

export function getToday(): CalendarDate {
  const now = new Date()
  return new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
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

export function sortableHeader(label: string) {
  return ({ column }: { column: any }) => {
    const isSorted = column.getIsSorted()
    return h('button', {
      type: 'button',
      class: 'flex items-center gap-1 text-left cursor-pointer hover:text-primary transition-colors',
      onClick: (e: Event) => {
        e.preventDefault()
        column.toggleSorting()
      }
    }, [
      h('span', { class: 'font-medium text-foreground' }, label),
      h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '14',
        height: '14',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        class: [
          'shrink-0 transition-transform',
          isSorted === 'asc' ? 'rotate-180' : '',
          !isSorted ? 'text-muted opacity-50' : 'text-primary'
        ]
      }, [
        h('path', { d: 'm6 9 6 6 6-6' })
      ])
    ])
  }
}
