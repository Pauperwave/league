<!-- app\components\players\PlayersEmptyState.vue -->
<script setup lang="ts">
const props = defineProps<{
  type: 'no-search-results' | 'no-decks-filter' | 'no-players'
  searchQuery?: string
}>()

const emit = defineEmits<{
  createPlayer: []
  clearFilter: []
}>()

function handleAction() {
  const event = config.value.action.event
  if (event === 'createPlayer') emit('createPlayer')
  else if (event === 'clearFilter') emit('clearFilter')
}

const config = computed(() => ({
  'no-search-results': {
    icon: 'i-lucide-search-x',
    title: `Nessun risultato per "${props.searchQuery}"`,
    description: 'Vuoi creare un nuovo giocatore?',
    action: {
      label: 'Crea Giocatore',
      icon: 'i-lucide-user-plus',
      color: 'primary' as const,
      event: 'createPlayer' as const
    }
  },
  'no-decks-filter': {
    icon: 'i-lucide-layers',
    title: 'Nessun giocatore ha mazzi associati',
    description: 'Disattiva il filtro per vedere tutti i giocatori',
    action: {
      label: 'Mostra tutti',
      icon: undefined,
      color: 'neutral' as const,
      event: 'clearFilter' as const
    }
  },
  'no-players': {
    icon: 'i-lucide-users',
    title: 'Nessun giocatore trovato',
    description: 'Inizia creando il primo giocatore',
    action: {
      label: 'Crea Giocatore',
      icon: 'i-lucide-user-plus',
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
