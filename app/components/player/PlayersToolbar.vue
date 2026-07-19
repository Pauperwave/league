<!-- app\components\player\PlayersToolbar.vue -->
<script setup lang="ts">
const searchQuery = defineModel<string>('searchQuery', { required: true })
const showOnlyWithDecks = defineModel<boolean>('showOnlyWithDecks', { required: true })
const showOnlyActive = defineModel<boolean>('showOnlyActive', { required: true })

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-4 flex-wrap">
    <UInput
      v-model="searchQuery"
      type="search"
      :icon="ICONS.search"
      :placeholder="t('player.toolbar.searchPlaceholder')"
      class="max-w-sm flex-1"
    />
    <PlayerFilterSwitch v-model="showOnlyWithDecks" />
    <PlayerActiveFilterSwitch v-model="showOnlyActive" />
  </div>
</template>
