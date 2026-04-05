import { resolveComponent, h, type VNode } from 'vue'

export type StatusColor = 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'primary' | 'secondary'

export function formatDate(date: string | null): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('it-IT')
}

export function sortableHeader(label: string) {
  return ({ column }: { column: any }) => {
    const UButton = resolveComponent('UButton')
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

export const defaultTableUi = {
  root: 'border border-default',
  th: 'border-b border-default',
  td: 'border-b border-default'
}

export function createLoadingSlot(): VNode {
  return h('div', { class: 'flex items-center justify-center py-12' }, [
    h('i', { class: 'i-lucide-loader-2 animate-spin text-4xl text-primary' })
  ])
}

export function createEmptySlot(title: string, description: string, icon: string): VNode {
  const LazyUEmpty = resolveComponent('LazyUEmpty')
  return h(LazyUEmpty, {
    title,
    description,
    icon
  })
}
