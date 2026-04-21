<script setup lang="ts">
import type { Seat, TournamentTable } from '#shared/utils/types'

interface TableStatus {
  color: 'success' | 'warning' | 'error'
  label: string
}

interface Props {
  tables: TournamentTable[]
  isDragging: boolean
  getTableCardClass: (table: TournamentTable) => string
  getTableStatus: (table: TournamentTable) => TableStatus
  getTableScore: (tableIndex: number) => number
}

const { tables, isDragging, getTableCardClass, getTableStatus, getTableScore } = defineProps<Props>()
const emit = defineEmits<{
  updateSeats: [tableIndex: number, seats: [Seat, Seat, Seat, Seat]]
  dragStart: []
  dragEnd: []
  openBreakdown: [tableIndex: number]
}>()
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
    <TableCard
      v-for="(table, tableIndex) in tables"
      :key="table.id"
      :table="table"
      :table-index="tableIndex"
      :is-dragging="isDragging"
      :table-card-class="getTableCardClass(table)"
      :table-status="getTableStatus(table)"
      :table-score="getTableScore(tableIndex)"
      @update-seats="(index, seats) => emit('updateSeats', index, seats)"
      @drag-start="emit('dragStart')"
      @drag-end="emit('dragEnd')"
      @open-breakdown="index => emit('openBreakdown', index)"
    />
  </div>
</template>
