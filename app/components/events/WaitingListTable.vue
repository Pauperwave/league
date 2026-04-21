<!-- app/components/Events/WaitingListTable.vue -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { UCheckbox } from '#components'
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

// --- State ---

const searchQuery = ref('')
const rowSelection = ref<Record<string, boolean>>({})
const columnVisibility = ref({ playerId: false })

const playerState = reactive<Record<number, { paid: boolean; companion: boolean }>>(
  Object.fromEntries(props.data.map(p => [p.playerId, { paid: p.paid, companion: p.companion }]))
)

watch(() => props.data, (data) => {
  data.forEach(p => {
    playerState[p.playerId] = { paid: p.paid, companion: p.companion }
  })
}, { deep: true })

function emitUpdate(playerId: number) {
  const state = playerState[playerId]
  if (!state) return
  emit('update', { playerId, paid: state.paid, companion: state.companion })
}

// --- Selection ---

const selectedPlayerIds = computed(() =>
  Object.entries(rowSelection.value)
    .filter(([, selected]) => selected)
    .map(([id]) => Number(id))
)

const hasSelection = computed(() => selectedPlayerIds.value.length > 0)

function executeBatch(updateFn: ((id: number) => void) | null, batchEmitFn: (ids: number[]) => void) {
  if (!hasSelection.value) return
  const ids = selectedPlayerIds.value
  if (updateFn) {
    ids.forEach(id => { updateFn(id); emitUpdate(id) })
  }
  batchEmitFn(ids)
  rowSelection.value = {}
}

function togglePlayer(playerId: number, field: 'paid' | 'companion') {
  const state = playerState[playerId]
  if (!state) return
  setPlayer(playerId, field, !state[field])
}

function setPlayer(playerId: number, field: 'paid' | 'companion', value: boolean) {
  const state = playerState[playerId]
  if (!state) return
  state[field] = value
  emitUpdate(playerId)
}

// --- Columns ---

const columns = computed<TableColumn<WaitingPlayer>[]>(() => [
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
        'onUpdate:modelValue': (value: unknown) => table.toggleAllPageRowsSelected(!!(value as boolean)),
        'aria-label': 'Select all',
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: unknown) => row.toggleSelected(!!(value as boolean)),
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
        modelValue: playerState[row.original.playerId]?.companion ?? false,
        color: 'warning',
        size: 'sm',
        'aria-label': `Companion per ${row.original.name}`,
        'onUpdate:modelValue': () => togglePlayer(row.original.playerId, 'companion'),
      }),
  },
  {
    id: 'paid',
    header: 'Pagato',
    enableHiding: false,
    meta: { class: { th: 'text-center w-20', td: 'text-center' } },
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: playerState[row.original.playerId]?.paid ?? false,
        color: 'success',
        size: 'sm',
        'aria-label': `Pagato per ${row.original.name}`,
        'onUpdate:modelValue': () => togglePlayer(row.original.playerId, 'paid'),
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
])

// --- Filtering & Meta ---

const filteredData = computed(() => {
  if (!searchQuery.value) return props.data
  const query = searchQuery.value.toLowerCase()
  return props.data.filter(p =>
    p.name.toLowerCase().includes(query) || p.playerId.toString().includes(query)
  )
})

const columnVisibilityItems = computed(() => [
  {
    label: 'ID',
    type: 'checkbox' as const,
    checked: columnVisibility.value.playerId !== false,
    onUpdateChecked(checked: boolean) {
      columnVisibility.value = { playerId: checked }
    },
    onSelect(e: Event) { e.preventDefault() },
  },
])

const meta = computed(() => ({
  class: {
    tr: (row: { original: WaitingPlayer }) => {
      const state = playerState[row.original.playerId]
      if (state?.paid && state?.companion) return 'bg-success/10 hover:bg-success/20'
      if (state?.paid || state?.companion) return 'bg-warning/10 hover:bg-warning/20'
      return 'hover:bg-muted/50'
    },
  },
}))
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <UInput v-model="searchQuery" placeholder="Cerca giocatori..." class="max-w-sm" />
      <UDropdownMenu :items="columnVisibilityItems" :content="{ align: 'end' }">
        <UButton label="Columns" color="neutral" trailing-icon="i-lucide-chevron-down" />
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
            size="xs" color="success" variant="soft" icon="i-lucide-dollar-sign"
            :disabled="!hasSelection"
            @click="executeBatch(id => setPlayer(id, 'paid', true), ids => emit('batchMarkPaid', ids))"
          >
            Marca pagati
          </UButton>
          <UButton
            size="xs" color="warning" variant="soft" icon="i-lucide-users"
            :disabled="!hasSelection"
            @click="executeBatch(id => setPlayer(id, 'companion', true), ids => emit('batchMarkCompanion', ids))"
          >
            Marca companion
          </UButton>
          <UButton
            size="xs" color="error" variant="soft" icon="i-lucide-trash-2"
            :disabled="!hasSelection"
            @click="executeBatch(null, ids => emit('batchRemove', ids))"
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
        <div v-if="searchQuery" class="flex flex-col items-center gap-1 py-4 text-muted">
          <UIcon name="i-lucide-search-x" class="text-4xl mb-1" />
          <p>Nessun risultato per "{{ searchQuery }}"</p>
        </div>
        <UEmpty v-else title="Nessun giocatore in lista d'attesa" icon="i-lucide-users" />
      </template>
    </UTable>
  </div>
</template>