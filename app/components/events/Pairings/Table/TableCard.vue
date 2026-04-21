<script setup lang="ts">
import type { Seat, TournamentTable } from '#shared/utils/types'
import { VueDraggable } from 'vue-draggable-plus'

interface TableStatus {
  color: 'success' | 'warning' | 'error'
  label: string
}

interface Props {
  table: TournamentTable
  tableIndex: number
  isDragging: boolean
  tableCardClass: string
  tableStatus: TableStatus
  tableScore: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updateSeats: [tableIndex: number, seats: [Seat, Seat, Seat, Seat]]
  dragStart: []
  dragEnd: []
  openBreakdown: [tableIndex: number]
}>()

const seatsModel = computed({
  get: () => props.table.seats,
  set: (nextSeats: Seat[]) => emit('updateSeats', props.tableIndex, nextSeats as [Seat, Seat, Seat, Seat]),
})

const visibleSeats = computed(() => {
  const occupiedCount = props.table.seats.filter(seat => seat.player !== null).length
  return occupiedCount >= 4 ? props.table.seats.filter(seat => seat.player !== null) : props.table.seats
})
</script>

<template>
  <UCard
    :class="tableCardClass"
    :ui="{ header: 'px-2 py-1.5 sm:px-2 sm:py-1.5', body: 'px-2 py-2 sm:px-2 sm:py-2' }"
  >
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-grid-2x2" class="size-4 text-primary" />
          <span class="font-semibold text-base">Tavolo {{ table.tableNumber }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-eye"
            @click="emit('openBreakdown', tableIndex)"
          >
            Punteggio: {{ tableScore.toFixed(2) }}
          </UButton>
          <UBadge :color="tableStatus.color" variant="soft" size="sm" class="text-base font-semibold leading-none">
            {{ tableStatus.label }}
          </UBadge>
        </div>
      </div>
    </template>

    <VueDraggable
      v-model="seatsModel"
      tag="div"
      class="grid grid-cols-2 gap-2"
      :group="{ name: 'seats', pull: true, put: true }"
      handle=".drag-handle"
      :animation="180"
      ghost-class="!opacity-0"
      chosen-class="scale-95"
      @start="emit('dragStart')"
      @end="emit('dragEnd')"
    >
      <TableSeatItem
        v-for="seat in visibleSeats"
        :key="seat.id"
        :seat="seat"
        :is-dragging="isDragging"
      />
    </VueDraggable>
  </UCard>
</template>
