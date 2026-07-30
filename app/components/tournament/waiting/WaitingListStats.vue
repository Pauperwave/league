<!-- app\components\tournament\waiting\WaitingListStats.vue -->
<script setup lang="ts">

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

// Table breakdown only makes sense once the count yields a valid table split (3, 4, or 6+ players).
const hasValidTableSplit = computed(() => {
  const count = debouncedCount.value
  return count >= 3 && count !== 5
})

const statsState = computed(() => {
  const count = debouncedCount.value

  if (count === 0) {
    return {
      label: t('tournament.waitingListStats.noPlayers'),
      color: 'warning' as const,
      show: true
    }
  }

  if (count <= 2) {
    return {
      label: t('tournament.waitingListStats.minPlayers', { count }),
      color: 'warning' as const,
      show: true
    }
  }

  if (count === 5) {
    return {
      label: t('tournament.waitingListStats.invalidFive'),
      color: 'error' as const,
      show: true
    }
  }

  // 3, 4, or 6+ giocatori
  return {
    label: t('tournament.waitingListStats.playersCount', { count }),
    color: 'info' as const,
    show: true
  }
})

const tableEstimateLabel = computed(() =>
  hasValidTableSplit.value ? debouncedEstimate.value : undefined
)
</script>

<template>
  <div v-if="statsState.show" class="flex items-center gap-2">
    <UBadge
      :color="statsState.color"
      size="lg"
      variant="subtle"
      :ui="{ base: 'px-2.5 py-1.5 text-sm font-medium' }"
    >
      {{ statsState.label }}
    </UBadge>
    <span v-if="tableEstimateLabel" class="text-sm font-medium text-highlighted">{{ tableEstimateLabel }}</span>
  </div>
</template>
