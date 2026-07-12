<!-- app\components\PlayerDeckCount.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  playerId: number
}>()

const decksStore = useCommanderDeckStore()
const { t } = useI18n()

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
    {{ t('player.deckCount', deckCount, { named: { count: deckCount } }) }}
  </UBadge>
</template>
