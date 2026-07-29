<!-- app\components\event\EventActionBar.vue -->
<script setup lang="ts">
import type { TournamentStatus } from '#shared/utils/types'

const { t } = useI18n()

const props = defineProps<{
  currentRound: number
  totalRounds: number
  eventStatus: TournamentStatus
  canStartTournament: boolean
  canAdvance: boolean
}>()

const emit = defineEmits<{
  start: []
  cancelRound: []
  advance: []
  end: []
}>()

const showStartButton = computed(() => props.eventStatus === 'registration')
const isLastRound = computed(() => props.currentRound === props.totalRounds && props.currentRound > 0)

const cancelRoundLogging = useButtonLogging('Annulla round', {
  currentRound: () => props.currentRound,
  totalRounds: () => props.totalRounds,
  eventStatus: () => props.eventStatus,
})

const startEventLogging = useButtonLogging('Avvia evento', {
  eventStatus: () => props.eventStatus,
  canStartTournament: () => props.canStartTournament,
})

function cancelRound() {
  cancelRoundLogging.logClick()
  emit('cancelRound')
}

function handleStartEvent() {
  startEventLogging.logClick()
  emit('start')
}
</script>

<template>
  <div v-if="showStartButton" class="flex justify-center">
    <StartEventButton
      :disabled="!canStartTournament"
      @click="handleStartEvent"
    />
  </div>

  <div v-else-if="eventStatus === 'playing' || eventStatus === 'ended'" class="flex gap-2 justify-center">
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
</template>
