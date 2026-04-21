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
  stepChanged: [step: string]
}>()

const showStartButton = computed(() => !props.isPlaying && props.isRegistrationOpen)

function handleStepChanged(step: string) {
  emit('stepChanged', step)
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <UCard class="w-full max-w-2xl">
      <EventStepper
        :current-round="currentRound"
        :total-rounds="totalRounds"
        :is-event-ended="isEventEnded"
        :is-playing="isPlaying"
        class="mb-4"
        @step-changed="handleStepChanged"
      >
        <template #content="{ item }">
          <slot name="content" :item="item" />
        </template>
      </EventStepper>
      <StartEventButton
        v-if="showStartButton"
        :disabled="!canStartEvent"
        @click="emit('start')"
      />
    </UCard>
  </div>
</template>
