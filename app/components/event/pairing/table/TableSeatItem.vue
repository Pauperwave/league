<!-- app\components\event\pairing\table\TableSeatItem.vue -->
<script setup lang="ts">
import type { Seat } from '#shared/utils/types'

const { t } = useI18n()

const props = defineProps<{
  seat: Seat
  isDragging: boolean
  playerId?: number
  hasCommander?: boolean
}>()

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
        :aria-label="t('event.pairing.dragPlayerAriaLabel')"
      >
        <UIcon :name="ICONS.dragHandle" class="size-4 cursor-grab hover:cursor-grab active:cursor-grabbing" />
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
        :color="hasCommander ? 'success' : 'neutral'"
        :icon="hasCommander ? ICONS.commanderSet : ICONS.commanderNotSet"
        :aria-label="t('event.pairing.commanderAriaLabel')"
        @click="handleCommanderClick"
      />
    </div>

    <div
      v-else
      class="h-full min-h-10 flex items-center justify-center gap-1.5 text-base px-1.5 py-1"
      :class="isDragging ? 'text-amber-700' : 'text-muted'"
    >
      <UIcon :name="ICONS.add" class="size-4" />
      <span>{{ isDragging ? t('event.pairing.dropHere') : t('event.pairing.emptySlot') }}</span>
    </div>
  </div>
</template>
