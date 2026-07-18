<!-- app\components\player\PlayerDeckCount.vue -->
<script setup lang="ts">

const props = defineProps<{
  playerId: number
}>()

// Colada cache of all decks (ADR-015) — shared with the pages, no refetch
const { data: decksData } = useDecksQuery()
const { t } = useI18n()

const deckCount = computed(() => {
  return (decksData.value ?? []).filter(d => d.player_id === props.playerId).length
})
</script>

<template>
  <UBadge
    :color="deckCount > 0 ? 'warning' : 'error'"
    variant="soft"
    class="shrink-0"
  >
    {{ t('player.deckCount', deckCount, { named: { count: deckCount } }) }}
  </UBadge>
</template>
