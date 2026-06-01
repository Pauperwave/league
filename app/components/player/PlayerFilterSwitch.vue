<!-- app/components/PlayerFilterSwitch.vue -->
<script setup lang="ts">
const playersStore = usePlayerStore()
const decksStore = useCommanderDeckStore()

const showOnlyWithDecks = defineModel<boolean>('modelValue', { required: true })

const playersWithDecksCount = computed(() =>
  playersStore.players.filter(p => decksStore.getDecksByPlayerId(p.player_id).length > 0).length,
)

const label = computed(() =>
  showOnlyWithDecks.value
    ? `Solo con mazzi (${playersWithDecksCount.value})`
    : `Tutti i giocatori (${playersStore.players.length})`,
)
</script>

<template>
  <label class="flex items-center gap-2 cursor-pointer shrink-0">
    <USwitch v-model="showOnlyWithDecks" />
    <span class="text-sm font-medium">{{ label }}</span>
  </label>
</template>
