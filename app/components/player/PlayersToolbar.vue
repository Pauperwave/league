<!-- app\components\players\PlayersToolbar.vue -->
<script setup lang="ts">
import { SORT_OPTIONS, type SortField } from '~/composables/players/usePlayersFilter'

const searchQuery = defineModel<string>('searchQuery', { required: true })
const showOnlyWithDecks = defineModel<boolean>('showOnlyWithDecks', { required: true })
const sortBy = defineModel<SortField>('sortBy', { required: true })
const sortDirection = defineModel<'asc' | 'desc'>('sortDirection', { required: true })
</script>

<template>
  <div class="flex items-center gap-4 flex-wrap">
    <UInput
      v-model="searchQuery"
      type="search"
      icon="i-lucide-search"
      placeholder="Cerca giocatore per nome..."
      class="max-w-sm flex-1"
    />
    <PlayerFilterSwitch v-model="showOnlyWithDecks" />
    <div class="flex items-center gap-2 shrink-0 ml-auto">
      <USelect v-model="sortBy" :items="SORT_OPTIONS" placeholder="Ordina per..." class="w-40" />
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        :icon="sortDirection === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
        :aria-label="sortDirection === 'asc' ? 'Ordina decrescente' : 'Ordina crescente'"
        :title="sortDirection === 'asc' ? 'Ordina decrescente' : 'Ordina crescente'"
        @click="() => { sortDirection = sortDirection === 'asc' ? 'desc' : 'asc' }"
      />
    </div>
  </div>
</template>
