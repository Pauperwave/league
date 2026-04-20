🧱 Architecture
1. useWaitingListTable.ts (composable)
Handles:
search
selection
batch logic (emit only)
No UI
2. WaitingListTable.vue
Pure table rendering
Emits row-level actions
No toolbar, no search
3. WaitingListToolbar.vue
Search input
Batch actions
Column visibility dropdown
✅ 1. Composable
// app/composables/useWaitingListTable.ts
import type { RowSelectionState } from '@tanstack/vue-table'

export interface WaitingPlayer {
  index: number
  playerId: number
  name: string
  time: string
  paid: boolean
  companion: boolean
}

export function useWaitingListTable(data: Ref<WaitingPlayer[]>) {
  const searchQuery = ref('')
  const rowSelection = ref<RowSelectionState>({})

  const selectedPlayerIds = computed(() =>
    Object.entries(rowSelection.value)
      .filter(([, selected]) => selected)
      .map(([id]) => Number(id))
  )

  const hasSelection = computed(() => selectedPlayerIds.value.length > 0)

  const filteredData = computed(() => {
    if (!searchQuery.value) return data.value
    const query = searchQuery.value.toLowerCase()

    return data.value.filter(row =>
      row.name.toLowerCase().includes(query) ||
      row.playerId.toString().includes(query)
    )
  })

  function clearSelection() {
    rowSelection.value = {}
  }

  return {
    searchQuery,
    rowSelection,
    selectedPlayerIds,
    hasSelection,
    filteredData,
    clearSelection,
  }
}
✅ 2. Table Component (pure UI)
<!-- app/components/Events/WaitingListTable.vue -->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import ActionButtons from '~/components/ui/ActionButtons.vue'
import type { WaitingPlayer } from '~/composables/useWaitingListTable'

const UCheckbox = resolveComponent('UCheckbox')

const props = defineProps<{
  data: WaitingPlayer[]
  rowSelection: any
}>()

const emit = defineEmits<{
  update: [{ playerId: number; paid: boolean; companion: boolean }]
  edit: [playerId: number]
  remove: [playerId: number]
  'update:rowSelection': [any]
}>()

// -------------------
// Columns
// -------------------
const columns: TableColumn<WaitingPlayer>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean) =>
          table.toggleAllPageRowsSelected(!!value),
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean) =>
          row.toggleSelected(!!value),
        onClick: (e: Event) => e.stopPropagation(),
      }),
  },
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'playerId', header: 'ID' },
  { accessorKey: 'name', header: 'Giocatore' },
  { accessorKey: 'time', header: 'Inserito alle' },
  {
    id: 'companion',
    header: 'Companion',
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.original.companion,
        color: 'warning',
        size: 'sm',
        'onUpdate:modelValue': (value: boolean) =>
          emit('update', {
            playerId: row.original.playerId,
            paid: row.original.paid,
            companion: value,
          }),
      }),
  },
  {
    id: 'paid',
    header: 'Pagato',
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.original.paid,
        color: 'success',
        size: 'sm',
        'onUpdate:modelValue': (value: boolean) =>
          emit('update', {
            playerId: row.original.playerId,
            paid: value,
            companion: row.original.companion,
          }),
      }),
  },
  {
    id: 'actions',
    header: 'Azioni',
    cell: ({ row }) =>
      h(ActionButtons, {
        showEdit: true,
        showDelete: true,
        onEdit: () => emit('edit', row.original.playerId),
        onDelete: () => emit('remove', row.original.playerId),
      }),
  },
]

// Row styling
const meta = {
  class: {
    tr: (row: { original: WaitingPlayer }) => {
      const { paid, companion } = row.original

      if (paid && companion) return 'bg-success/10'
      if (paid || companion) return 'bg-warning/10'
      return ''
    },
  },
}
</script>

<template>
  <UTable
    v-model:row-selection="props.rowSelection"
    :data="data"
    :columns="columns"
    :meta="meta"
    :get-row-id="(row) => String(row.playerId)"
    @update:row-selection="emit('update:rowSelection', $event)"
  />
</template>
✅ 3. Toolbar Component
<!-- app/components/Events/WaitingListToolbar.vue -->
<script setup lang="ts">
const props = defineProps<{
  searchQuery: string
  hasSelection: boolean
  selectedCount: number
}>()

const emit = defineEmits<{
  'update:searchQuery': [string]
  batchPaid: []
  batchCompanion: []
  batchRemove: []
}>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <UInput
        :model-value="searchQuery"
        @update:model-value="emit('update:searchQuery', $event)"
        placeholder="Cerca giocatori..."
        class="max-w-sm"
      />
    </div>

    <div class="flex items-center gap-2 p-2 bg-muted/50 rounded">
      <span class="text-sm text-muted">
        <template v-if="hasSelection">
          {{ selectedCount }} selezionati
        </template>
        <span v-else class="text-muted/50">
          Seleziona giocatori
        </span>
      </span>

      <div class="ml-auto flex gap-1">
        <UButton size="xs" color="success" :disabled="!hasSelection" @click="emit('batchPaid')">
          Pagati
        </UButton>
        <UButton size="xs" color="warning" :disabled="!hasSelection" @click="emit('batchCompanion')">
          Companion
        </UButton>
        <UButton size="xs" color="error" :disabled="!hasSelection" @click="emit('batchRemove')">
          Rimuovi
        </UButton>
      </div>
    </div>
  </div>
</template>
✅ 4. Usage (Parent Page)

This is where everything connects cleanly:

<script setup lang="ts">
import { useWaitingListTable } from '~/composables/useWaitingListTable'

const data = ref<WaitingPlayer[]>([])

const table = useWaitingListTable(data)

// API / state handlers
function handleUpdate(payload) {}
function handleBatchPaid() {}
function handleBatchCompanion() {}
function handleBatchRemove() {}
</script>

<template>
  <WaitingListToolbar
    v-model:searchQuery="table.searchQuery"
    :hasSelection="table.hasSelection"
    :selectedCount="table.selectedPlayerIds.length"
    @batchPaid="handleBatchPaid"
    @batchCompanion="handleBatchCompanion"
    @batchRemove="handleBatchRemove"
  />

  <WaitingListTable
    :data="table.filteredData"
    v-model:rowSelection="table.rowSelection"
    @update="handleUpdate"
  />
</template>
🔥 Why this is actually clean
Composable = logic only
Table = rendering only
Toolbar = controls only
Parent = source of truth
🚀 Result

You now have:

reusable table (can be used without toolbar)
reusable toolbar (can control other tables)
testable logic (composable)
zero sync bugs
