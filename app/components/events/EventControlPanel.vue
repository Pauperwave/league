<!-- app/components/Events/EventControlPanel.vue -->
<script setup lang="ts">
import type { EventStatus } from '#shared/utils/types'
import { useButtonLogging } from '~/composables/useButtonLogging'

const props = defineProps<{
  currentRound: number
  totalRounds: number
  eventStatus: EventStatus
  canStartEvent: boolean
  canAdvance: boolean
}>()

const emit = defineEmits<{
  start: []
  stepChanged: [step: string]
  cancelRound: []
  advance: []
  end: []
}>()

const showStartButton = computed(() => props.eventStatus === 'registration')
const isLastRound = computed(() => props.currentRound === props.totalRounds && props.currentRound > 0)
const stepper = useTemplateRef('stepper')

const cancelRoundLogging = useButtonLogging('Annulla round', {
  currentRound: () => props.currentRound,
  totalRounds: () => props.totalRounds,
  eventStatus: () => props.eventStatus,
})

const startEventLogging = useButtonLogging('Avvia evento', {
  eventStatus: () => props.eventStatus,
  canStartEvent: () => props.canStartEvent,
})

function handleStepChanged(step: string) {
  emit('stepChanged', step)
}

function cancelRound() {
  cancelRoundLogging.logClick()
  emit('cancelRound')
  stepper.value?.prev()
}

function handleStartEvent() {
  startEventLogging.logClick()
  emit('start')
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <StartEventButton
      v-if="showStartButton"
      :disabled="!canStartEvent"
      @click="handleStartEvent"
    />
    <UCard>
      <EventStepper
        ref="stepper"
        :current-round="currentRound"
        :total-rounds="totalRounds"
        :event-status="eventStatus"
        @step-changed="handleStepChanged"
      >
        <template #content="{ item }">
          <div class="bg-warning-100 dark:bg-warning-950/30 -mx-6 -my-4 px-6 py-4 rounded-lg">
            <div v-if="eventStatus === 'playing' || eventStatus === 'ended'" class="flex gap-2 justify-between mb-4">
              <UTooltip :content="{ side: 'top' }" text="Torna al round precedente">
                <UButton
                  leading-icon="i-lucide-arrow-left"
                  color="error"
                  variant="outline"
                  @click="cancelRound"
                >
                  Annulla round
                </UButton>
              </UTooltip>

              <UTooltip v-if="eventStatus === 'playing'" :content="{ side: 'top' }" :text="isLastRound ? 'Termina l\'evento' : (props.canAdvance ? 'Procedi al round successivo' : 'Dati dei tavoli incompleti')">
                <UButton
                  :trailing-icon="isLastRound ? 'i-lucide-flag' : 'i-lucide-arrow-right'"
                  :color="props.canAdvance ? 'success' : 'neutral'"
                  :disabled="!props.canAdvance"
                  @click="isLastRound ? emit('end') : emit('advance')"
                >
                  {{ isLastRound ? 'Termina evento' : 'Avanti' }}
                </UButton>
              </UTooltip>
            </div>
            <slot name="content" :item="item" />
          </div>
        </template>
      </EventStepper>
    </UCard>
  </div>
</template>
