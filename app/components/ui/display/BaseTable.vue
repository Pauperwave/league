<!-- app\components\ui\display\BaseTable.vue -->
<script setup lang="ts" generic="T extends object">
import type { TableColumn } from '@nuxt/ui'

const props = defineProps<{
  data: T[]
  columns: TableColumn<T>[]
  meta?: Record<string, unknown>
  loading?: boolean
  sorting?: { id: string; desc: boolean }[]
  emptyTitle: string
  emptyDescription: string
  emptyIcon: string
  getRowId?: (row: T) => string
  onRowClick?: (row: T) => void
}>()

// UTable's own onRowSelect already ignores clicks landing on a nested
// <button>/<a> (checkboxes, action buttons, the name link), so this and a
// cell-level link to the same destination don't double-navigate.
function handleSelect(_event: Event, row: { original: T }) {
  props.onRowClick?.(row.original)
}

// Row selection is opt-in: only tables that define a "select" column (see
// useTableUtils.ts's createSelectionColumn) and pass getRowId use this —
// tables that don't bind :row-selection just leave it undefined, which
// UTable/TanStack treats as "selection disabled," so existing tables are
// unaffected.
const rowSelection = defineModel<Record<string, boolean>>('rowSelection', { default: () => ({}) })
</script>

<template>
  <UTable
    v-model:row-selection="rowSelection"
    :data="data"
    :columns="columns"
    :meta="meta"
    :loading="loading"
    :sorting="sorting"
    :get-row-id="getRowId"
    :on-select="onRowClick ? handleSelect : undefined"
    class="w-full"
    :ui="{
      root: 'border border-default',
      th: 'border-b border-default',
      td: 'border-b border-default',
      tr: 'data-[selectable=true]:cursor-pointer'
    }"
  >
    <template #loading>
      <div class="flex items-center justify-center py-12">
        <UIcon
          :name="ICONS.loading"
          class="animate-spin text-4xl text-primary"
        />
      </div>
    </template>

    <template #empty>
      <LazyUEmpty
        :title="emptyTitle"
        :description="emptyDescription"
        :icon="emptyIcon"
      />
    </template>
  </UTable>
</template>
