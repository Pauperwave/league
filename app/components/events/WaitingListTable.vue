<!-- app/components/Events/WaitingListTable.vue -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import ActionButtons from '~/components/ui/ActionButtons.vue'

interface WaitingPlayer {
  index: number
  playerId: number
  name: string
  time: string
  paid: boolean
  companion: boolean
}

const props = defineProps<{
  data: WaitingPlayer[]
}>()

const emit = defineEmits<{
  update: [{ playerId: number; paid: boolean; companion: boolean }]
  edit: [playerId: number]
  remove: [playerId: number]
  batchRemove: [playerIds: number[]]
  batchMarkPaid: [playerIds: number[]]
  batchMarkCompanion: [playerIds: number[]]
}>()

const searchQuery = ref('')
const rowSelection = ref<Record<string, boolean>>({})

const paidPlayers = ref(new Set(props.data.filter(p => p.paid).map(p => p.playerId)))
const companionPlayers = ref(new Set(props.data.filter(p => p.companion).map(p => p.playerId)))

function toggleSet<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set)
  if (next.has(item)) {
    next.delete(item)
  } else {
    next.add(item)
  }
  return next
}

function emitUpdate(playerId: number) {
  emit('update', {
    playerId,
    paid: paidPlayers.value.has(playerId),
    companion: companionPlayers.value.has(playerId),
  })
}

const selectedPlayerIds = computed(() =>
  Object.entries(rowSelection.value)
    .filter(([, selected]) => selected)
    .map(([id]) => Number(id))
)

const hasSelection = computed(() => selectedPlayerIds.value.length > 0)

function handleBatchMarkPaid() {
  if (!hasSelection.value) return
  paidPlayers.value = new Set([...paidPlayers.value, ...selectedPlayerIds.value])
  selectedPlayerIds.value.forEach(emitUpdate)
  emit('batchMarkPaid', selectedPlayerIds.value)
  rowSelection.value = {}
}

function handleBatchMarkCompanion() {
  if (!hasSelection.value) return
  companionPlayers.value = new Set([...companionPlayers.value, ...selectedPlayerIds.value])
  selectedPlayerIds.value.forEach(emitUpdate)
  emit('batchMarkCompanion', selectedPlayerIds.value)
  rowSelection.value = {}
}

function handleBatchRemove() {
  if (!hasSelection.value) return
  emit('batchRemove', selectedPlayerIds.value)
  rowSelection.value = {}
}

const columns: TableColumn<WaitingPlayer>[] = [
  {
    id: 'select',
    enableHiding: false,
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsAllPageRowsSelected()
          ? true
          : table.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : false,
        'onUpdate:modelValue': (value: boolean) => table.toggleAllPageRowsSelected(!!value),
        'aria-label': 'Select all',
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean) => row.toggleSelected(!!value),
        onClick: (e: Event) => e.stopPropagation(),
        'aria-label': `Seleziona ${row.original.name}`,
      }),
  },
  {
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
    accessorKey: 'name',
    header: 'Giocatore',
    meta: { class: { td: 'font-medium' } },
  },
  {
    accessorKey: 'time',
    header: 'Inserito alle',
    meta: { class: { th: 'text-center', td: 'text-center' } },
  },
  {
    id: 'companion',
    header: 'Companion',
    enableHiding: false,
    meta: { class: { th: 'text-center w-20', td: 'text-center' } },
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: companionPlayers.value.has(row.original.playerId),
        color: 'warning',
        size: 'sm',
        'aria-label': `Companion per ${row.original.name}`,
        'onUpdate:modelValue': () => {
          companionPlayers.value = toggleSet(companionPlayers.value, row.original.playerId)
          emitUpdate(row.original.playerId)
        },
      }),
  },
  {
    id: 'paid',
    header: 'Pagato',
    enableHiding: false,
    meta: { class: { th: 'text-center w-20', td: 'text-center' } },
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: paidPlayers.value.has(row.original.playerId),
        color: 'success',
        size: 'sm',
        'aria-label': `Pagato per ${row.original.name}`,
        'onUpdate:modelValue': () => {
          paidPlayers.value = toggleSet(paidPlayers.value, row.original.playerId)
          emitUpdate(row.original.playerId)
        },
      }),
  },
  {
    id: 'actions',
    header: 'Azioni',
    enableHiding: false,
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) =>
      h(ActionButtons, {
        showView: false,
        showEdit: true,
        showDelete: true,
        onEdit: () => emit('edit', row.original.playerId),
        onDelete: () => emit('remove', row.original.playerId),
      }),
  },
]

const filteredData = computed(() => {
  if (!searchQuery.value) return props.data
  const query = searchQuery.value.toLowerCase()
  return props.data.filter(row =>
    row.name.toLowerCase().includes(query) || row.playerId.toString().includes(query)
  )
})

const table = useTemplateRef('table')

const columnVisibility = ref({
  playerId: false
})

const columnVisibilityItems = computed(() => {
  const api = table?.value?.tableApi
  if (!api) return []

  return api.getAllColumns()
    .filter((column: any) => column.getCanHide())
    .map((column: any) => ({
      label: column.id,
      type: 'checkbox' as const,
      checked: column.getIsVisible(),
      onUpdateChecked(checked: boolean) {
        api.getColumn(column.id)?.toggleVisibility(!!checked)
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    }))
})

const meta = computed(() => {
  const paid = paidPlayers.value
  const companion = companionPlayers.value

  return {
    class: {
      tr: (row: { original: WaitingPlayer }) => {
        const { playerId } = row.original
        const isPaid = paid.has(playerId)
        const isCompanion = companion.has(playerId)

        const classes: string[] = []

        if (isPaid && isCompanion) {
          classes.push('bg-success/10', 'hover:bg-success/20')
        } else if (isPaid || isCompanion) {
          classes.push('bg-warning/10', 'hover:bg-warning/20')
        } else {
          classes.push('hover:bg-muted/50')
        }

        return classes.join(' ')
      },
    },
  }
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <UInput v-model="searchQuery" placeholder="Cerca giocatori..." class="max-w-sm" />
      <UDropdownMenu
        :items="columnVisibilityItems"
        :content="{ align: 'end' }"
      >
        <UButton
          label="Columns"
          color="neutral"
          trailing-icon="i-lucide-chevron-down"
        />
      </UDropdownMenu>
    </div>

    <div class="min-h-12 flex items-center">
      <div class="flex items-center gap-2 p-2 bg-muted/50 rounded transition-all duration-200">
        <span class="text-sm text-muted min-w-32">
          <template v-if="hasSelection">
            {{ selectedPlayerIds.length }} giocatori selezionati
          </template>
          <span v-else class="text-muted/50">
            Seleziona giocatori per azioni batch
          </span>
        </span>
        <div class="flex items-center gap-1 ml-auto">
          <UButton
            size="xs"
            color="success"
            variant="soft"
            icon="i-lucide-dollar-sign"
            :disabled="!hasSelection"
            @click="handleBatchMarkPaid"
          >
            Marca pagati
          </UButton>
          <UButton
            size="xs"
            color="warning"
            variant="soft"
            icon="i-lucide-users"
            :disabled="!hasSelection"
            @click="handleBatchMarkCompanion"
          >
            Marca companion
          </UButton>
          <UButton
            size="xs"
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            :disabled="!hasSelection"
            @click="handleBatchRemove"
          >
            Rimuovi selezionati
          </UButton>
        </div>
      </div>
    </div>

    <UTable
      v-model:row-selection="rowSelection"
      v-model:column-visibility="columnVisibility"
      :data="filteredData"
      :columns="columns"
      :meta="meta"
      sticky
      class="w-full max-h-150"
      :ui="{
        root: 'border border-default',
        th: 'border-b border-default py-2',
        td: 'border-b border-default py-1',
      }"
      :get-row-id="(row) => String(row.playerId)"
    >
      <template #empty>
        <div
          v-if="searchQuery"
          class="flex flex-col items-center gap-1 py-4 text-muted"
        >
          <UIcon name="i-lucide-search-x" class="text-4xl mb-1" />
          <p>Nessun risultato per "{{ searchQuery }}"</p>
        </div>
        <UEmpty
          v-else
          title="Nessun giocatore in lista d'attesa"
          icon="i-lucide-users"
        />
      </template>
    </UTable>
  </div>
</template>

