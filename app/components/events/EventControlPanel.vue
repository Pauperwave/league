<!-- app\components\Events\EventControlPanel.vue -->
<script setup lang="ts">
interface Props {
  currentRound: number
  totalRounds: number
  isPlaying: boolean
  isEventEnded: boolean
  isRegistrationOpen: boolean
  canStartEvent: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  start: []
}>()
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div class="border-2 border-dashed border-white rounded-lg p-4 w-full max-w-2xl">
      <EventStepper
        :current-round="currentRound"
        :total-rounds="totalRounds"
        :is-event-ended="isEventEnded"
        class="mb-4"
      />
      <StartEventButton
        v-if="!isPlaying && isRegistrationOpen"
        :disabled="!canStartEvent"
        @click="emit('start')"
      />
    </div>
  </div>
</template>
