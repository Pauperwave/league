<!-- app\components\ui\display\BaseTable.vue -->
<script setup lang="ts" generic="T extends object">
import { ICONS } from '~/utils/icons'
import type { TableColumn } from '@nuxt/ui'

defineProps<{
  data: T[]
  columns: TableColumn<T>[]
  meta?: Record<string, unknown>
  loading?: boolean
  sorting?: { id: string; desc: boolean }[]
  emptyTitle: string
  emptyDescription: string
  emptyIcon: string
}>()
</script>

<template>
  <UTable
    :data="data"
    :columns="columns"
    :meta="meta"
    :loading="loading"
    :sorting="sorting"
    class="w-full"
    :ui="{
      root: 'border border-default',
      th: 'border-b border-default',
      td: 'border-b border-default'
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
