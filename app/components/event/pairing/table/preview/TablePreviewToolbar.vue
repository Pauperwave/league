<!-- app\components\events\Pairings\Table\TablePreviewToolbar.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
const {
  totalScore,
  loading = false,
} = defineProps<{
  totalScore: number
  loading?: boolean
}>()

const emit = defineEmits<{
  openSettings: []
  optimize: []
}>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-sm text-muted">
      Punteggio totale: <span class="font-semibold text-default">{{ totalScore.toFixed(2) }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton size="sm" color="neutral" variant="soft" :icon="ICONS.settings" @click="emit('openSettings')">
        Pesi e Vincoli
      </UButton>
      <UButton size="sm" color="neutral" variant="outline" :icon="ICONS.shuffle" :disabled="loading" @click="emit('optimize')">
        Ottimizza
      </UButton>
    </div>
  </div>
</template>
