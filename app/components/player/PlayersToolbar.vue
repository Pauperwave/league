<!-- app\components\players\PlayersToolbar.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { SORT_FIELDS, type SortField } from '~/composables/players/usePlayersFilter'

const searchQuery = defineModel<string>('searchQuery', { required: true })
const showOnlyWithDecks = defineModel<boolean>('showOnlyWithDecks', { required: true })
const sortBy = defineModel<SortField>('sortBy', { required: true })
const sortDirection = defineModel<'asc' | 'desc'>('sortDirection', { required: true })

const { t } = useI18n()

const sortItems = computed(() =>
  SORT_FIELDS.map((field) => ({ label: t(`player.sortOptions.${field}`), value: field }))
)
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
    <div class="flex items-center gap-2 shrink-0 ml-auto">
      <USelect v-model="sortBy" :items="sortItems" :placeholder="t('player.toolbar.sortPlaceholder')" class="w-40" />
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        :icon="sortDirection === 'asc' ? ICONS.up : ICONS.down"
        :aria-label="sortDirection === 'asc' ? t('player.toolbar.sortDescAriaLabel') : t('player.toolbar.sortAscAriaLabel')"
        :title="sortDirection === 'asc' ? t('player.toolbar.sortDescAriaLabel') : t('player.toolbar.sortAscAriaLabel')"
        @click="() => { sortDirection = sortDirection === 'asc' ? 'desc' : 'asc' }"
      />
    </div>
  </div>
</template>
