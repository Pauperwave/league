<!-- app\components\player\PlayersEmptyState.vue -->
<script setup lang="ts">
const props = defineProps<{
  type: 'no-search-results' | 'no-decks-filter' | 'no-active-filter' | 'no-players'
  searchQuery?: string
}>()

const emit = defineEmits<{
  createPlayer: []
  clearFilter: []
}>()

const { t } = useI18n()

function handleAction() {
  const event = config.value.action.event
  if (event === 'createPlayer') emit('createPlayer')
  else if (event === 'clearFilter') emit('clearFilter')
}

const config = computed(() => ({
  'no-search-results': {
    icon: ICONS.noResults,
    title: t('player.emptyState.noResultsTitle', { query: props.searchQuery ?? '' }),
    description: t('player.emptyState.noResultsDescription'),
    action: {
      label: t('player.emptyState.createPlayer'),
      icon: ICONS.addPlayer,
      color: 'primary' as const,
      event: 'createPlayer' as const
    }
  },
  'no-decks-filter': {
    icon: ICONS.noDecks,
    title: t('player.emptyState.noDecksTitle'),
    description: t('player.emptyState.noDecksDescription'),
    action: {
      label: t('player.emptyState.showAll'),
      icon: undefined,
      color: 'neutral' as const,
      event: 'clearFilter' as const
    }
  },
  'no-active-filter': {
    icon: ICONS.players,
    title: t('player.emptyState.noActiveTitle'),
    description: t('player.emptyState.noActiveDescription'),
    action: {
      label: t('player.emptyState.showAll'),
      icon: undefined,
      color: 'neutral' as const,
      event: 'clearFilter' as const
    }
  },
  'no-players': {
    icon: ICONS.players,
    title: t('player.emptyState.noPlayersTitle'),
    description: t('player.emptyState.noPlayersDescription'),
    action: {
      label: t('player.emptyState.createPlayer'),
      icon: ICONS.addPlayer,
      color: 'primary' as const,
      event: 'createPlayer' as const
    }
  },
})[props.type])
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 space-y-4">
    <UIcon :name="config.icon" class="size-16 text-muted opacity-30" />
    <div class="text-center space-y-1">
      <p class="text-lg font-semibold">{{ config.title }}</p>
      <p class="text-sm text-muted">{{ config.description }}</p>
    </div>
    <UButton
      :icon="config.action.icon"
      :color="config.action.color"
      variant="outline"
      @click="handleAction"
    >
      {{ config.action.label }}
    </UButton>
  </div>
</template>
