<!-- app\components\event\EventStepper.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import type { StepperItem } from '@nuxt/ui'
import type { EventStatus } from '#shared/utils/types'

const { t } = useI18n()

const props = defineProps<{
  /** Current round number (1-based) */
  currentRound: number
  /** Total number of rounds in the event */
  totalRounds: number
  /** Current event status */
  eventStatus: EventStatus
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
      title: t('event.stepper.registrationTitle'),
      description: t('event.stepper.registrationDescription'),
      icon: ICONS.registration,
      value: 'registration',
    },
  ]

  for (let i = 1; i <= props.totalRounds; i++) {
    steps.push({
      title: t('event.stepper.roundTitle', { n: i }),
      description: i < props.currentRound
        ? t('event.stepper.roundCompleted')
        : i === props.currentRound
          ? t('event.stepper.roundInProgress')
          : t('event.stepper.roundPending'),
      icon: ICONS.battle,
      value: `round-${i}`,
    })
  }

  steps.push({
    title: t('event.status.ended'),
    description: t('event.stepper.endedDescription'),
    icon: ICONS.flag,
    value: 'ended',
  })

  return steps
})

const currentStep = computed(() => {
  if (props.eventStatus === 'ended') return 'ended'
  if (props.currentRound > 0) return `round-${props.currentRound}`
  return 'registration'
})

const internalStep = ref(currentStep.value)
watch(currentStep, (val) => { internalStep.value = val })

function handleStepClick(value: string | number | undefined) {
  // Always reset back to the current step to prevent visual state from changing
  internalStep.value = currentStep.value

  if (typeof value === 'string' && value.startsWith('round-')) {
    const round = parseInt(value.replace('round-', ''), 10)
    if (round < props.currentRound) {
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
      @update:model-value="handleStepClick"
    >
      <template #content="{ item }">
        <slot name="content" :item="item" />
      </template>
    </UStepper>
  </div>
</template>
