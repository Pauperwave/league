<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'

interface Props {
  isPlaying: boolean
  isEventEnded: boolean
}

const props = defineProps<Props>()

const items: StepperItem[] = [
  { title: 'Registrazione', description: 'Iscrizioni aperte', icon: 'i-lucide-clipboard-list', value: 'registration' },
  { title: 'In Corso', description: 'Round attivi', icon: 'i-lucide-swords', value: 'playing' },
  { title: 'Terminato', description: 'Evento concluso', icon: 'i-lucide-flag', value: 'ended' },
]

const currentStep = computed(() => {
  if (props.isEventEnded) return 'ended'
  if (props.isPlaying) return 'playing'
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
