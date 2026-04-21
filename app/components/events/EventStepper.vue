<!-- app/components/Events/EventStepper.vue -->
<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'

const props = defineProps<{
  /** Current round number (1-based) */
  currentRound: number
  /** Total number of rounds in the event */
  totalRounds: number
  /** Whether the event has ended */
  isEventEnded: boolean
  /** Whether the event is currently playing */
  isPlaying: boolean
}>()

const emit = defineEmits<{
  stepChanged: [step: string]
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
  if (props.isEventEnded) return 'ended'
  if (props.currentRound > 0) return `round-${props.currentRound}`
  return 'registration'
})

function handleStepChange(value: string | number | undefined) {
  if (typeof value === 'string') {
    emit('stepChanged', value)
  }
}
</script>

<template>
  <div class="w-full">
    <UStepper
      ref="stepper"
      :items="items"
      :model-value="currentStep"
      class="w-full"
      @update:model-value="handleStepChange"
    >
      <template #content="{ item }">
        <slot name="content" :item="item" />
      </template>
    </UStepper>

    <div v-if="isPlaying" class="flex gap-2 justify-between mt-4">
      <UButton
        leading-icon="i-lucide-arrow-left"
        color="error"
        variant="outline"
        :disabled="!stepper?.hasPrev"
        @click="stepper?.prev()"
      >
        Annulla round
      </UButton>

      <UButton
        trailing-icon="i-lucide-arrow-right"
        disabled
      >
        Avanti
      </UButton>
    </div>
  </div>
</template>
