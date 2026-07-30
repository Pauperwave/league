<!-- app\components\tournament\waiting\WaitingListTable.vue -->
<script setup lang="ts">
import type { TableColumn, CheckboxProps } from '@nuxt/ui'
import type { Row, Table } from '@tanstack/vue-table'
import { UCheckbox } from '#components'
import RowActionButtons from '~/components/ui/actions/RowActionButtons.vue'
import PlayerNameTag from '~/components/player/PlayerNameTag.vue'

const { t } = useI18n()

interface WaitingPlayer {
  index: number
  playerId: number
  name: string
  surname: string
  time: string
  paid: boolean
}

function fullName(player: WaitingPlayer): string {
  return `${player.name} ${player.surname}`.trim()
}

const props = defineProps<{
  data: WaitingPlayer[]
}>()

const emit = defineEmits<{
  update: [{ playerId: number; paid: boolean }]
  edit: [playerId: number]
  remove: [playerId: number]
  batchRemove: [playerIds: number[]]
  batchMarkPaid: [playerIds: number[]]
}>()

// --- State ---

const searchQuery = ref('')
const rowSelection = ref<Record<string, boolean>>({})

const playerState = reactive<Record<number, { paid: boolean }>>(
  Object.fromEntries(props.data.map(p => [p.playerId, { paid: p.paid }]))
)

watch(() => props.data, (data) => {
  data.forEach(p => {
    playerState[p.playerId] = { paid: p.paid }
  })
}, { deep: true })

function emitUpdate(playerId: number) {
  const state = playerState[playerId]
  if (!state) return
  emit('update', { playerId, paid: state.paid })
}

// --- Removal confirmation ---

const playerIdToRemove = ref<number | null>(null)
const showRemoveConfirm = computed({
  get: () => playerIdToRemove.value !== null,
  set: (v) => { if (!v) playerIdToRemove.value = null },
})
const playerNameToRemove = computed(() => {
  const player = props.data.find((p) => p.playerId === playerIdToRemove.value)
  return player ? fullName(player) : ''
})

function handleConfirmRemove() {
  if (playerIdToRemove.value === null) return
  emit('remove', playerIdToRemove.value)
  playerIdToRemove.value = null
}

// --- Selection ---

// Shift+click range selection (row checkboxes only) — plain closure vars,
// not refs, since they don't drive any template rendering themselves.
let lastSelectedRowIndex: number | null = null
let shiftKeyHeld = false

function handleRowCheckboxClick(e: MouseEvent) {
  e.stopPropagation()
  shiftKeyHeld = e.shiftKey
}

/**
 * Toggles a single row on plain click; on shift+click, toggles every row
 * between the last-clicked row and this one (inclusive) to `value`, using
 * `row.index` — the row's position in the current filtered/sorted model —
 * so the range matches what's visually between the two checkboxes.
 */
function toggleRowSelection(table: Table<WaitingPlayer>, row: Row<WaitingPlayer>, value: boolean) {
  if (shiftKeyHeld && lastSelectedRowIndex !== null) {
    const rows = table.getRowModel().rows
    const [start, end] = lastSelectedRowIndex < row.index
      ? [lastSelectedRowIndex, row.index]
      : [row.index, lastSelectedRowIndex]
    for (let i = start; i <= end; i++) rows[i]?.toggleSelected(value)
  } else {
    row.toggleSelected(value)
  }
  lastSelectedRowIndex = row.index
  shiftKeyHeld = false
}

const selectedPlayerIds = computed(() =>
  Object.entries(rowSelection.value)
    .filter(([, selected]) => selected)
    .map(([id]) => Number(id))
)

const hasSelection = computed(() => selectedPlayerIds.value.length > 0)

const allSelectedPaid = computed(() =>
  hasSelection.value && selectedPlayerIds.value.every(id => playerState[id]?.paid)
)

function executeBatch(updateFn: ((id: number) => void) | null, batchEmitFn: (ids: number[]) => void) {
  if (!hasSelection.value) return
  const ids = selectedPlayerIds.value
  if (updateFn) {
    ids.forEach(id => { updateFn(id); emitUpdate(id) })
  }
  batchEmitFn(ids)
  rowSelection.value = {}
  lastSelectedRowIndex = null
}

function handleToggleMarkPaid() {
  const newValue = !allSelectedPaid.value
  executeBatch(id => setPlayer(id, 'paid', newValue), ids => emit('batchMarkPaid', ids))
}

// --- Batch removal confirmation ---

const showBatchRemoveConfirm = ref(false)

function handleBatchRemoveClick() {
  if (!hasSelection.value) return
  showBatchRemoveConfirm.value = true
}

function handleConfirmBatchRemove() {
  showBatchRemoveConfirm.value = false
  executeBatch(null, ids => emit('batchRemove', ids))
}

function togglePlayer(playerId: number, field: 'paid') {
  const state = playerState[playerId]
  if (!state) return
  setPlayer(playerId, field, !state[field])
}

function setPlayer(playerId: number, field: 'paid', value: boolean) {
  const state = playerState[playerId]
  if (!state) return
  state[field] = value
  emitUpdate(playerId)
}

// --- Columns ---

function createToggleColumn(
  id: 'paid',
  color: CheckboxProps['color'],
  headerKey: string,
  ariaLabelKey: string,
): TableColumn<WaitingPlayer> {
  return {
    id,
    header: t(headerKey),
    enableHiding: false,
    meta: { class: { th: 'text-center w-20', td: 'text-center' } },
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: playerState[row.original.playerId]?.[id] ?? false,
        color,
        'aria-label': t(ariaLabelKey, { name: fullName(row.original) }),
        'onUpdate:modelValue': () => togglePlayer(row.original.playerId, id),
      }),
  }
}

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
        'aria-label': t('tournament.waitingListTable.selectAllAriaLabel'),
      }),
    cell: ({ row, table }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: unknown) => toggleRowSelection(table, row, !!(value as boolean)),
        onClick: handleRowCheckboxClick,
        'aria-label': t('tournament.waitingListTable.selectRowAriaLabel', { name: fullName(row.original) }),
      }),
  },
  {
    accessorKey: 'index',
    header: '#',
    meta: { class: { th: 'w-10 text-right', td: 'w-10 text-right' } },
  },
  {
    accessorKey: 'name',
    header: t('tournament.waitingListTable.playerColumn'),
    meta: { class: { td: 'font-medium' } },
    cell: ({ row }) => {
      const { name, surname } = row.original
      const match = searchQuery.value ? fuzzyMatch(fullName(row.original), searchQuery.value) : null
      if (!match) {
        return h(PlayerNameTag, { name, surname, playerId: row.original.playerId, avatarSize: 'md' })
      }
      // fullName() joins as `${name} ${surname}` — split the combined match
      // indices back onto each part (-1 for the joining space).
      const nameIndices = match.indices.filter(i => i < name.length)
      const surnameIndices = match.indices.filter(i => i > name.length).map(i => i - name.length - 1)
      return h(PlayerNameTag, { name, surname, playerId: row.original.playerId, avatarSize: 'md' }, {
        name: () => highlightFuzzyChars(name, nameIndices),
        surname: () => highlightFuzzyChars(surname, surnameIndices),
      })
    },
  },
  {
    accessorKey: 'time',
    header: t('tournament.waitingListTable.timeColumn'),
    meta: { class: { th: 'text-center', td: 'text-center' } },
  },
  createToggleColumn('paid', 'success', 'tournament.waitingListTable.paidColumn', 'tournament.waitingListTable.paidAriaLabel'),
  {
    id: 'actions',
    header: t('tournament.waitingListTable.actionsColumn'),
    enableHiding: false,
    meta: { class: { th: 'text-center', td: 'text-center' } },
    cell: ({ row }) =>
      h(RowActionButtons, {
        showView: false,
        showEdit: true,
        showDelete: true,
        entityLabel: fullName(row.original),
        onEdit: () => emit('edit', row.original.playerId),
        onDelete: () => { playerIdToRemove.value = row.original.playerId },
      }),
  },
])

// --- Filtering & Meta ---

const filteredData = computed(() => {
  if (!searchQuery.value) return props.data

  const query = searchQuery.value
  return props.data
    .map(p => ({ player: p, match: fuzzyMatch(fullName(p), query) }))
    .filter(({ player, match }) => match !== null || player.playerId.toString().includes(query))
    .sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0))
    .map(({ player }) => player)
})

const meta = computed(() => ({
  class: {
    tr: (row: { original: WaitingPlayer }) => {
      const state = playerState[row.original.playerId]
      if (state?.paid) return 'bg-success/10 hover:bg-success/20'
      return 'hover:bg-muted/50'
    },
  },
}))
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <UInput v-model="searchQuery" :icon="ICONS.search" :placeholder="t('tournament.waitingListTable.searchPlaceholder')" class="max-w-sm" />
        <slot name="search-actions" />
      </div>
      <div v-if="hasSelection" class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-highlighted">
          {{ t('tournament.waitingListTable.selectedCount', { count: selectedPlayerIds.length }) }}
        </span>
        <UButton
          size="xs" :color="allSelectedPaid ? 'neutral' : 'success'" variant="subtle" :icon="ICONS.paid"
          @click="handleToggleMarkPaid"
        >
          {{ allSelectedPaid ? t('tournament.waitingListTable.unmarkPaid') : t('tournament.waitingListTable.markPaid') }}
        </UButton>
        <UButton
          size="xs" color="error" variant="subtle" :icon="ICONS.delete"
          @click="handleBatchRemoveClick"
        >
          {{ t('tournament.waitingListTable.removeSelected') }}
        </UButton>
      </div>
    </div>

    <div class="w-full overflow-x-auto">
      <UTable
        v-model:row-selection="rowSelection"
        :data="filteredData"
        :columns="columns"
        :meta="meta"
        sticky
        class="max-h-150"
        :ui="{
          root: 'border border-default',
          // Nuxt UI's default `base` is `min-w-full`, forcing the table to
          // stretch to fill its container even when the content (short
          // columns like '#'/checkboxes/time) doesn't need the space —
          // dropping min-w-full lets it size to content instead, while the
          // wrapping overflow-x-auto div still scrolls it on narrow screens.
          base: 'overflow-clip',
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
            <UIcon
              :name="ICONS.noResults"
              class="text-4xl mb-1"
            />
            <p>{{ t('tournament.waitingListTable.noResultsFor', { query: searchQuery }) }}</p>
          </div>
          <UEmpty
            v-else
            :title="t('tournament.waitingListTable.emptyTitle')"
            :icon="ICONS.players"
          />
        </template>
      </UTable>
    </div>

    <ConfirmModal
      v-model:open="showRemoveConfirm"
      :title="t('tournament.waitingListTable.removeConfirm.title')"
      :description="t('tournament.waitingListTable.removeConfirm.description')"
      :question="t('tournament.waitingListTable.removeConfirm.question')"
      :subject="playerNameToRemove"
      @confirm="handleConfirmRemove"
    />

    <ConfirmModal
      v-model:open="showBatchRemoveConfirm"
      :title="t('tournament.waitingListTable.batchRemoveConfirm.title')"
      :description="t('tournament.waitingListTable.batchRemoveConfirm.description')"
      :question="t('tournament.waitingListTable.batchRemoveConfirm.question', { count: selectedPlayerIds.length })"
      @confirm="handleConfirmBatchRemove"
    />
  </div>
</template>
