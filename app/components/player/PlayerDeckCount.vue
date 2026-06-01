<!-- app\components\PlayerDeckCount.vue -->
<script setup lang="ts">
const props = defineProps<{
  playerId: number
}>()

const decksStore = useCommanderDeckStore()

const deckCount = computed(() => {
  return decksStore.getDecksByPlayerId(props.playerId).length
})
</script>

<template>
  <UBadge
    :color="deckCount > 0 ? 'warning' : 'error'"
    variant="soft"
    class="shrink-0"
  >
    {{ deckCount }} {{ deckCount === 1 ? 'mazzo' : 'mazzi' }}
  </UBadge>
</template>
