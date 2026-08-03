<!-- app\components\tournament\TournamentActionBar.vue -->
<script setup lang="ts">
import type { TournamentStatus } from '#shared/utils/types'

const { t } = useI18n()

const props = defineProps<{
  currentRound: number
  totalRounds: number
  tournamentStatus: TournamentStatus
  canStartTournament: boolean
  canAdvance: boolean
}>()

const emit = defineEmits<{
  start: []
  cancelRound: []
  advance: []
  end: []
  correctLastRound: []
}>()

const showStartButton = computed(() => props.tournamentStatus === 'registration')
const isLastRound = computed(() => props.currentRound === props.totalRounds && props.currentRound > 0)

const cancelRoundLogging = useButtonLogging(t('logging.tournament.cancelRound'), {
  currentRound: () => props.currentRound,
  totalRounds: () => props.totalRounds,
  tournamentStatus: () => props.tournamentStatus,
})

const startEventLogging = useButtonLogging(t('logging.tournament.startEvent'), {
  tournamentStatus: () => props.tournamentStatus,
  canStartTournament: () => props.canStartTournament,
})

const advanceRoundLogging = useButtonLogging(t('logging.tournament.advanceRound'), {
  currentRound: () => props.currentRound,
  canAdvance: () => props.canAdvance,
})

const endEventLogging = useButtonLogging(t('logging.tournament.endEvent'), {
  currentRound: () => props.currentRound,
  totalRounds: () => props.totalRounds,
})

const correctLastRoundLogging = useButtonLogging(t('logging.tournament.correctLastRound'), {
  currentRound: () => props.currentRound,
})

function cancelRound() {
  cancelRoundLogging.logClick()
  emit('cancelRound')
}

function correctLastRound() {
  correctLastRoundLogging.logClick()
  emit('correctLastRound')
}

function handleStartEvent() {
  startEventLogging.logClick()
  emit('start')
}

function handleAdvanceOrEnd() {
  if (isLastRound.value) {
    endEventLogging.logClick()
    emit('end')
  } else {
    advanceRoundLogging.logClick()
    emit('advance')
  }
}
</script>

<template>
  <div v-if="showStartButton" class="flex justify-start">
    <StartTournamentButton
      :disabled="!canStartTournament"
      @click="handleStartEvent"
    />
  </div>

  <div v-else-if="tournamentStatus === 'playing'" class="flex gap-2 justify-start">
    <UTooltip :content="{ side: 'top' }" :text="t('tournament.controlPanel.backToPreviousRoundTooltip')">
      <UButton
        :leading-icon="ICONS.back"
        color="error"
        variant="outline"
        @click="cancelRound"
      >
        {{ t('tournament.cancelRound.confirmLabel') }}
      </UButton>
    </UTooltip>

    <UTooltip
      :content="{ side: 'top' }"
      :text="isLastRound
        ? t('tournament.controlPanel.endEventTooltip')
        : (props.canAdvance
          ? t('tournament.controlPanel.advanceTooltip')
          : t('tournament.controlPanel.incompleteDataTooltip'))"
    >
      <UButton
        :trailing-icon="isLastRound ? ICONS.flag : ICONS.forward"
        :color="props.canAdvance ? 'success' : 'neutral'"
        :disabled="!props.canAdvance"
        @click="handleAdvanceOrEnd"
      >
        {{ isLastRound ? t('tournament.endEvent.title') : t('tournament.controlPanel.advanceButton') }}
      </UButton>
    </UTooltip>
  </div>

  <div v-else-if="tournamentStatus === 'ended'" class="flex gap-2 justify-start">
    <UTooltip :content="{ side: 'top' }" :text="t('tournament.correctLastRound.tooltip')">
      <UButton
        :leading-icon="ICONS.edit"
        color="neutral"
        variant="outline"
        @click="correctLastRound"
      >
        {{ t('tournament.correctLastRound.button') }}
      </UButton>
    </UTooltip>
  </div>
</template>
