<!-- app\components\player\PlayerActiveFilterSwitch.vue -->
<script setup lang="ts">

// Colada cache (ADR-015) — shared with the pages, no refetch
const { data: playersData } = usePlayersQuery()

const showOnlyActive = defineModel<boolean>('modelValue', { required: true })

const { t } = useI18n()

const players = computed(() => playersData.value ?? [])
const activePlayersCount = computed(() => players.value.filter(p => p.is_active).length)

const label = computed(() =>
  showOnlyActive.value
    ? t('player.filterSwitch.onlyActive', { count: activePlayersCount.value })
    : t('player.filterSwitch.allPlayers', { count: players.value.length }),
)
</script>

<template>
  <label class="flex items-center gap-2 cursor-pointer shrink-0">
    <USwitch v-model="showOnlyActive" />
    <span class="text-sm font-medium">{{ label }}</span>
  </label>
</template>
