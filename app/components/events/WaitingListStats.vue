<!-- app\components\Events\WaitingListStats.vue -->
<script setup lang="ts">
interface Props {
  playerCount: number
  tableEstimate?: string
}

const props = defineProps<Props>()

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
      label: 'Nessun giocatore',
      color: 'warning' as const,
      show: true
    }
  }

  if (count <= 2) {
    return {
      label: `${count} / 3 giocatori minimi`,
      color: 'warning' as const,
      show: true
    }
  }

  if (count === 5) {
    return {
      label: '5 giocatori: configurazione non valida',
      color: 'error' as const,
      show: true
    }
  }

  // 3, 4, or 6+ giocatori
  const parts: string[] = []
  parts.push(`${count} giocatori`)
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
