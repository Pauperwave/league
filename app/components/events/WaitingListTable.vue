<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'

// TODO Nuxt auto-imports everything from ~/utils, so it would then be available globally without an explicit import
export function upperFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const UCheckbox = resolveComponent('UCheckbox')
const UButton = resolveComponent('UButton')

// — Local types replacing @tanstack/vue-table imports —

interface TableRow<T> {
  original: T
  getIsSelected: () => boolean
  toggleSelected: (value: boolean) => void
}

interface TableInstance {
  getIsSomePageRowsSelected: () => boolean
  getIsAllPageRowsSelected: () => boolean
  toggleAllPageRowsSelected: (value: boolean) => void
}

interface TableColumn_ {
  id: string
  getCanHide: () => boolean
  getIsVisible: () => boolean
  toggleVisibility: (visible: boolean) => void
}

interface UTableApi {
  getColumn: (id: string) => Pick<TableColumn_, 'toggleVisibility'> | undefined
  getAllColumns: () => TableColumn_[]
}

interface UTableExposed {
  tableApi: UTableApi | undefined
}

interface WaitingPlayerTableMeta {
  class: {
    tr: (row: TableRow<WaitingPlayer>) => string
  }
}

// — Component types —

interface WaitingPlayer {
  index: number
  playerId: number
  name: string
  time: string
  paid: boolean
  companion: boolean
}

defineProps<{
  data: WaitingPlayer[]
}>()

const searchQuery = defineModel<string>('searchQuery', { default: '' })

const emit = defineEmits<{
  togglePaid: [playerId: number]
  toggleCompanion: [playerId: number]
  remove: [playerId: number]
}>()

const rowSelection = ref<Record<string, boolean>>({})

const columns: TableColumn<WaitingPlayer>[] = [
  {
    id: 'select',
    header: ({ table }: { table: TableInstance }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!value),
        'aria-label': 'Select all',
      }),
    cell: ({ row }: { row: TableRow<WaitingPlayer> }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'aria-label': 'Select row',
      }),
  },
  {
    id: 'index',
    accessorKey: 'index',
    header: '#',
    meta: { class: { th: 'w-10 text-right', td: 'w-10 text-right' } },
  },
  {
    id: 'playerId',
    accessorKey: 'playerId',
    header: 'ID',
    enableHiding: true,
    meta: { class: { th: 'w-16 text-center', td: 'w-16 text-center font-mono' } },
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Giocatore',
    meta: { class: { td: 'font-medium' } },
  },
  {
    id: 'time',
    accessorKey: 'time',
    header: 'Inserito alle',
    meta: { class: { th: 'text-center', td: 'text-center' } },
  },
  {
    id: 'companion',
    header: 'Companion',
    enableHiding: false,
    meta: { class: { th: 'text-center w-20', td: 'text-center' } },
    cell: ({ row }: { row: TableRow<WaitingPlayer> }) =>
      h(UCheckbox, {
        modelValue: row.original.companion,
        color: 'warning',
        size: 'sm',
        'onUpdate:modelValue': () => emit('toggleCompanion', row.original.playerId),
      }),
  },
  {
    id: 'paid',
    header: 'Pagato',
    enableHiding: false,
    meta: { class: { th: 'text-center w-20', td: 'text-center' } },
    cell: ({ row }: { row: TableRow<WaitingPlayer> }) =>
      h(UCheckbox, {
        modelValue: row.original.paid,
        color: 'success',
        size: 'sm',
        'onUpdate:modelValue': () => emit('togglePaid', row.original.playerId),
      }),
  },
  {
    id: 'actions',
    header: 'Azioni',
    enableHiding: false,
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }: { row: TableRow<WaitingPlayer> }) =>
      h(UButton, {
        color: 'error',
        variant: 'outline',
        size: 'sm',
        icon: 'i-lucide-trash-2',
        'aria-label': 'Rimuovi',
        onClick: () => emit('remove', row.original.playerId),
      }),
  },
]

const meta: WaitingPlayerTableMeta = {
  class: {
    tr: (row: TableRow<WaitingPlayer>) => {
      const { paid, companion } = row.original
      if (paid && companion) return 'bg-success/10'
      if (paid || companion) return 'bg-warning/10'
      return ''
    },
  },
}

const table = useTemplateRef<UTableExposed>('table')

onMounted(() => {
  table.value?.tableApi?.getColumn('playerId')?.toggleVisibility(false)
})

const columnVisibilityItems = computed(() =>
  table.value?.tableApi
    ?.getAllColumns()
    .filter(col => col.getCanHide())
    .map(col => ({
      label: upperFirst(col.id),
      type: 'checkbox' as const,
      checked: col.getIsVisible(),
      onUpdateChecked: (checked: boolean) => col.toggleVisibility(checked),
      onSelect: (e: Event) => e.preventDefault(),
    })) ?? []
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <UInput
        v-model="searchQuery"
        placeholder="Cerca giocatori..."
        class="max-w-sm"
      />
      <UDropdownMenu :items="columnVisibilityItems" :content="{ align: 'end' }">
        <UButton
          label="Colonne"
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-chevron-down"
          aria-label="Seleziona colonne"
        />
      </UDropdownMenu>
    </div>

    <UTable
      ref="table"
      v-model:row-selection="rowSelection"
      :data="data"
      :columns="columns"
      :meta="meta"
      sticky
      class="w-full max-h-150"
      :ui="{
        root: 'border border-default',
        th: 'border-b border-default py-2',
        td: 'border-b border-default py-1',
      }"
    >
      <template #empty>
        <UEmpty title="Nessun giocatore in lista d'attesa" icon="i-lucide-users" />
      </template>
      <template #no-filtered-results>
        <div class="flex flex-col items-center gap-1 py-4 text-muted">
          <UIcon name="i-lucide-search-x" class="text-4xl mb-1" />
          <p>Nessun risultato per "{{ searchQuery }}"</p>
          <p class="text-sm">Il giocatore potrebbe già essere nella lista d'attesa</p>
        </div>
      </template>
    </UTable>
  </div>
</template>
