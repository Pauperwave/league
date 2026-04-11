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
</script>

<template>
  <UStepper
    :items="items"
    :model-value="currentStep"
    disabled
    class="w-full"
  />
</template>
