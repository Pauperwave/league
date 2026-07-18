<!-- app\components\player\PlayerFilterSwitch.vue -->
<script setup lang="ts">

const playersStore = usePlayerStore()

// Colada cache of all decks (ADR-015)
const { data: decksData } = useDecksQuery()

const showOnlyWithDecks = defineModel<boolean>('modelValue', { required: true })

const { t } = useI18n()

const playerIdsWithDecks = computed(() => new Set((decksData.value ?? []).map(d => d.player_id)))

const playersWithDecksCount = computed(() =>
  playersStore.players.filter(p => playerIdsWithDecks.value.has(p.player_id)).length,
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
