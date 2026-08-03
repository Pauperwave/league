<!-- app\components\tournament\TournamentActionBar.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- the cancel-round and
// correct-last-round buttons in the template share the UTooltip+UButton
// outline shape but are two different actions (different icon/color/
// tooltip/handler); fallow's line-scoped ignore comment doesn't work inside
// <template> (only // comments in <script>, tested 2026-08-03), so this is
// file-scoped instead.
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
const isLastRound = computed(() =>
  props.currentRound === props.totalRounds && props.currentRound > 0
)

const advanceTooltip = computed(() => {
  if (isLastRound.value) return t('tournament.controlPanel.endEventTooltip')
  return props.canAdvance
    ? t('tournament.controlPanel.advanceTooltip')
    : t('tournament.controlPanel.incompleteDataTooltip')
})

const advanceLabel = computed(() => isLastRound.value
  ? t('tournament.endEvent.title')
  : t('tournament.controlPanel.advanceButton'))

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

  <!-- This block's cancel-round button and the correct-last-round button
       below (v-else-if="tournamentStatus === 'ended'") share the
       UTooltip+UButton outline shape — fallow flags them as a clone group,
       but they're two different actions (different icon/color/tooltip/
       handler) that only happen to render the same two Nuxt UI components.
       Left as-is; a shared wrapper would just rename the duplication rather
       than remove any real logic. -->
  <div v-else-if="tournamentStatus === 'playing'" class="flex gap-2 justify-start">
    <UTooltip
      :content="{ side: 'top' }"
      :text="t('tournament.controlPanel.backToPreviousRoundTooltip')"
    >
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
      :text="advanceTooltip"
    >
      <UButton
        :trailing-icon="isLastRound ? ICONS.flag : ICONS.forward"
        :color="props.canAdvance ? 'success' : 'neutral'"
        :disabled="!props.canAdvance"
        @click="handleAdvanceOrEnd"
      >
        {{ advanceLabel }}
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
