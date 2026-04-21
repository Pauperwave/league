<script setup lang="ts">
interface Props {
  totalScore: number
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

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
      <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-settings-2" @click="emit('openSettings')">
        Pesi e Vincoli
      </UButton>
      <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-shuffle" :disabled="loading" @click="emit('optimize')">
        Ottimizza
      </UButton>
    </div>
  </div>
</template>
