<!-- app\components\event\EventControlPanel.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import type { EventStatus } from '#shared/utils/types'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const { t } = useI18n()

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
  viewRound: [round: number]
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
    <UCard>
      <EventStepper
        ref="stepper"
        :current-round="currentRound"
        :total-rounds="totalRounds"
        :event-status="eventStatus"
        @step-changed="handleStepChanged"
        @view-round="(round: number) => emit('viewRound', round)"
      >
        <template #content="{ item }">
          <div v-if="showStartButton" class="flex gap-2 justify-end mb-4">
            <StartEventButton
              :disabled="!canStartEvent"
              @click="handleStartEvent"
            />
          </div>

          <div v-else-if="eventStatus === 'playing' || eventStatus === 'ended'" class="flex gap-2 justify-between mb-4">
            <UTooltip :content="{ side: 'top' }" :text="t('event.controlPanel.backToPreviousRoundTooltip')">
              <UButton
                :leading-icon="ICONS.back"
                color="error"
                variant="outline"
                @click="cancelRound"
              >
                {{ t('event.cancelRound.confirmLabel') }}
              </UButton>
            </UTooltip>

            <UTooltip v-if="eventStatus === 'playing'" :content="{ side: 'top' }" :text="isLastRound ? t('event.controlPanel.endEventTooltip') : (props.canAdvance ? t('event.controlPanel.advanceTooltip') : t('event.controlPanel.incompleteDataTooltip'))">
              <UButton
                :trailing-icon="isLastRound ? ICONS.flag : ICONS.forward"
                :color="props.canAdvance ? 'success' : 'neutral'"
                :disabled="!props.canAdvance"
                @click="isLastRound ? emit('end') : emit('advance')"
              >
                {{ isLastRound ? t('event.endEvent.title') : t('event.controlPanel.advanceButton') }}
              </UButton>
            </UTooltip>
          </div>

          <slot name="content" :item="item" />
        </template>
      </EventStepper>
    </UCard>
  </div>
</template>
