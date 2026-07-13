<!-- app\components\event\waiting\WaitingListStats.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  playerCount: number
  tableEstimate?: string
}>()

const { t } = useI18n()

// — Debounced values for smooth UI updates —
const debouncedCount = ref(props.playerCount)
watchDebounced(
  () => props.playerCount,
  count => { debouncedCount.value = count },
  { debounce: 500 }
)

const debouncedEstimate = ref(props.tableEstimate)
watchDebounced(
  () => props.tableEstimate,
  estimate => { debouncedEstimate.value = estimate },
  { debounce: 500 }
)

const statsState = computed(() => {
  const count = debouncedCount.value

  if (count === 0) {
    return {
      label: t('event.waitingListStats.noPlayers'),
      color: 'warning' as const,
      show: true
    }
  }

  if (count <= 2) {
    return {
      label: t('event.waitingListStats.minPlayers', { count }),
      color: 'warning' as const,
      show: true
    }
  }

  if (count === 5) {
    return {
      label: t('event.waitingListStats.invalidFive'),
      color: 'error' as const,
      show: true
    }
  }

  // 3, 4, or 6+ giocatori
  const parts: string[] = []
  parts.push(t('event.waitingListStats.playersCount', { count }))
  if (debouncedEstimate.value) parts.push(debouncedEstimate.value)

  return {
    label: parts.join(' = '),
    color: 'info' as const,
    show: true
  }
})
</script>

<template>
  <UBadge
    v-if="statsState.show"
    :color="statsState.color"
    size="lg"
    variant="subtle"
    :ui="{ base: 'px-2.5 py-1.5 text-sm font-medium' }"
  >
    {{ statsState.label }}
  </UBadge>
</template>
