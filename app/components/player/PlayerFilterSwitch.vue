<!-- app\components\player\PlayerFilterSwitch.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const playersStore = usePlayerStore()
const decksStore = useCommanderDeckStore()

const showOnlyWithDecks = defineModel<boolean>('modelValue', { required: true })

const { t } = useI18n()

const playersWithDecksCount = computed(() =>
  playersStore.players.filter(p => decksStore.getDecksByPlayerId(p.player_id).length > 0).length,
)

const label = computed(() =>
  showOnlyWithDecks.value
    ? t('player.filterSwitch.onlyWithDecks', { count: playersWithDecksCount.value })
    : t('player.filterSwitch.allPlayers', { count: playersStore.players.length }),
)
</script>

<template>
  <label class="flex items-center gap-2 cursor-pointer shrink-0">
    <USwitch v-model="showOnlyWithDecks" />
    <span class="text-sm font-medium">{{ label }}</span>
  </label>
</template>
