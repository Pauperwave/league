<!-- app/components/Events/EventControlPanel.vue -->
<script setup lang="ts">
const props = defineProps<{
  currentRound: number
  totalRounds: number
  isPlaying: boolean
  isEventEnded: boolean
  isRegistrationOpen: boolean
  canStartEvent: boolean
}>()

const emit = defineEmits<{
  start: []
}>()

const showStartButton = computed(() => !props.isPlaying && props.isRegistrationOpen)
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <UCard class="w-full max-w-2xl">
      <EventStepper
        :current-round="currentRound"
        :total-rounds="totalRounds"
        :is-event-ended="isEventEnded"
        class="mb-4"
      />
      <StartEventButton
        v-if="showStartButton"
        :disabled="!canStartEvent"
        @click="emit('start')"
      />
    </UCard>
  </div>
</template>
