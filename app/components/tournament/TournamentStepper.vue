<!-- app\components\tournament\TournamentStepper.vue -->
<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
import type { TournamentStatus } from '#shared/utils/types'

const { t } = useI18n()

const props = defineProps<{
  /** Current round number (1-based) */
  currentRound: number
  /** Total number of rounds in the tournament */
  totalRounds: number
  /** Current tournament status */
  tournamentStatus: TournamentStatus
}>()

const stepper = useTemplateRef('stepper')

const emit = defineEmits<{
  viewRound: [round: number]
}>()

defineSlots<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: (props: { item: StepperItem }) => any
}>()

const items = computed<StepperItem[]>(() => {
  const steps: StepperItem[] = [
    {
      title: t('tournament.stepper.registrationTitle'),
      description: t('tournament.stepper.registrationDescription'),
      icon: ICONS.registration,
      value: 'registration',
    },
  ]

  for (let i = 1; i <= props.totalRounds; i++) {
    steps.push({
      title: t('tournament.stepper.roundTitle', { n: i }),
      description: i < props.currentRound
        ? t('tournament.stepper.roundCompleted')
        : i === props.currentRound
          ? t('tournament.stepper.roundInProgress')
          : t('tournament.stepper.roundPending'),
      icon: ICONS.battle,
      value: `round-${i}`,
    })
  }

  steps.push({
    title: t('tournament.status.ended'),
    description: t('tournament.stepper.endedDescription'),
    icon: ICONS.flag,
    value: 'ended',
  })

  return steps
})

const currentStep = computed(() => {
  if (props.tournamentStatus === 'ended') return 'ended'
  if (props.currentRound > 0) return `round-${props.currentRound}`
  return 'registration'
})

const internalStep = ref(currentStep.value)
watch(currentStep, (val) => { internalStep.value = val })

/** The round being navigated to in the last handleStepClick call, for logging context. */
const lastViewedRound = ref(0)

const viewRoundLogging = useButtonLogging('Vai al round', {
  round: () => lastViewedRound.value,
  currentRound: () => props.currentRound,
})

function handleStepClick(value: string | number | undefined) {
  // Always reset back to the current step to prevent visual state from changing
  internalStep.value = currentStep.value

  if (typeof value === 'string' && value.startsWith('round-')) {
    const round = parseInt(value.replace('round-', ''), 10)
    if (round < props.currentRound) {
      lastViewedRound.value = round
      viewRoundLogging.logClick()
      emit('viewRound', round)
    }
  }
}

defineExpose({
  stepper,
  hasPrev: computed(() => stepper.value?.hasPrev ?? false),
  prev: () => stepper.value?.prev()
})
</script>

<template>
  <div class="w-full">
    <UStepper
      ref="stepper"
      v-model="internalStep"
      :items="items"
      class="w-full"
      :ui="{
        content: 'w-full',
        // Step nav (registration + every round + ended) scrolls horizontally
        // on narrow screens instead of squeezing every item's title/description
        // to fit the viewport — only the nav header, not the per-step content
        // below it (max-w-2xl/mx-auto/justify-center apply to the header
        // alone — putting them on the whole component instead would also
        // shrink the content panel below it, e.g. the waiting list, to the
        // same narrow width). items are shrink-0/w-auto (sized to content),
        // so without justify-center they'd just pack against the header's
        // own left edge instead of centering as a group.
        header: 'max-w-2xl mx-auto overflow-x-auto pb-1 justify-center',
        item: 'shrink-0 min-w-28 w-auto',
      }"
      @update:model-value="handleStepClick"
    >
      <template #content="{ item }">
        <slot name="content" :item="item" />
      </template>
    </UStepper>
  </div>
</template>
