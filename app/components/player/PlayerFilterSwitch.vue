<!-- app\components\player\PlayerFilterSwitch.vue -->
<script setup lang="ts">

// Colada caches (ADR-015) — shared with the pages, no refetch
const { data: playersData } = usePlayersQuery()
const { data: decksData } = useDecksQuery()

const showOnlyWithDecks = defineModel<boolean>('modelValue', { required: true })

const { t } = useI18n()

const players = computed(() => playersData.value ?? [])
const playerIdsWithDecks = computed(() => new Set((decksData.value ?? []).map(d => d.player_id)))

const playersWithDecksCount = computed(() =>
  players.value.filter(p => playerIdsWithDecks.value.has(p.player_id)).length,
)

const label = computed(() =>
  showOnlyWithDecks.value
    ? t('player.filterSwitch.onlyWithDecks', { count: playersWithDecksCount.value })
    : t('player.filterSwitch.allPlayers', { count: players.value.length }),
)
</script>

<template>
  <label class="flex items-center gap-2 cursor-pointer shrink-0">
    <USwitch v-model="showOnlyWithDecks" />
    <span class="text-sm font-medium">{{ label }}</span>
  </label>
</template>
