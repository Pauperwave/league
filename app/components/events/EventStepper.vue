<!-- app/components/Events/EventStepper.vue -->
<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
import type { EventStatus } from '#shared/utils/types'

const props = defineProps<{
  /** Current round number (1-based) */
  currentRound: number
  /** Total number of rounds in the event */
  totalRounds: number
  /** Current event status */
  eventStatus: EventStatus
}>()

const stepper = useTemplateRef('stepper')

defineSlots<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: (props: { item: StepperItem }) => any
}>()

const items = computed<StepperItem[]>(() => {
  const steps: StepperItem[] = [
    {
      title: 'Registrazione',
      description: 'Iscrizioni aperte',
      icon: 'i-lucide-clipboard-list',
      value: 'registration',
    },
  ]

  for (let i = 1; i <= props.totalRounds; i++) {
    steps.push({
      title: `Round ${i}`,
      description: i < props.currentRound
        ? 'Completato'
        : i === props.currentRound
          ? 'In corso'
          : 'In attesa',
      icon: 'i-lucide-swords',
      value: `round-${i}`,
    })
  }

  steps.push({
    title: 'Terminato',
    description: 'Evento concluso',
    icon: 'i-lucide-flag',
    value: 'ended',
  })

  return steps
})

const currentStep = computed(() => {
  if (props.eventStatus === 'ended') return 'ended'
  if (props.currentRound > 0) return `round-${props.currentRound}`
  return 'registration'
})

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
      :items="items"
      :model-value="currentStep"
      class="w-full"
      disabled
    >
      <template #content="{ item }">
        <slot name="content" :item="item" />
      </template>
    </UStepper>
  </div>
</template>
