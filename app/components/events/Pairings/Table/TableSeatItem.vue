<script setup lang="ts">
import type { Seat } from '#shared/utils/types'

interface Props {
  seat: Seat
  isDragging: boolean
  playerId?: number // For commander button
  hasCommander?: boolean // Whether commander is saved
}

const props = defineProps<Props>()

const emit = defineEmits<{
  openCommanderModal: [playerId: number]
}>()

const { playerInitial, playerDisplayName } = usePlayerDisplay()

function handleCommanderClick() {
  if (props.playerId) {
    emit('openCommanderModal', props.playerId)
  }
}
</script>

<template>
  <div
    class="rounded-md border transition-all"
    :class="seat.player
      ? 'border-default bg-default hover:ring-2 hover:ring-amber-400 hover:shadow-md'
      : isDragging
        ? 'border-dashed border-amber-400 bg-amber-50 animate-pulse'
        : 'border-dashed border-default/70 bg-muted/20'"
  >
    <div
      v-if="seat.player"
      class="h-full min-h-10 flex items-center gap-1.5 px-1.5 py-1"
    >
      <button
        type="button"
        class="drag-handle text-muted hover:text-default transition cursor-grab hover:cursor-grab active:cursor-grabbing"
        aria-label="Trascina giocatore"
      >
        <UIcon name="i-lucide-grip-vertical" class="size-4 cursor-grab hover:cursor-grab active:cursor-grabbing" />
      </button>

      <UAvatar
        :src="seat.player.avatarUrl"
        :alt="seat.player.name"
        class="shrink-0"
      >
        {{ playerInitial(seat.player) }}
      </UAvatar>

      <span class="text-base flex-1 whitespace-normal wrap-break-words leading-tight text-left">
        {{ playerDisplayName(seat.player).name }}
        <span class="font-bold text-highlighted">
          {{ ` ${playerDisplayName(seat.player).surname}` }}
        </span>
      </span>

      <UBadge
        v-if="seat.player.seed !== undefined"
        variant="subtle"
        color="warning"
      >
        #{{ seat.player.seed }}
      </UBadge>

      <UButton
        v-if="playerId"
        size="xs"
        variant="ghost"
        :color="hasCommander ? 'success' : 'warning'"
        :icon="hasCommander ? 'i-lucide-shield' : 'i-lucide-shield-plus'"
        aria-label="Imposta comandanti"
        @click="handleCommanderClick"
      />
    </div>

    <div
      v-else
      class="h-full min-h-10 flex items-center justify-center gap-1.5 text-base px-1.5 py-1"
      :class="isDragging ? 'text-amber-700' : 'text-muted'"
    >
      <UIcon name="i-lucide-plus" class="size-4" />
      <span>{{ isDragging ? 'Rilascia qui' : 'Slot libero' }}</span>
    </div>
  </div>
</template>
