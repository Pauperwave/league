<!-- app\components\DeckCardActions.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
import type { CommanderDeck } from '#shared/utils/types'

defineProps<{
  deck: CommanderDeck
  isUsedInEvents: boolean
}>()

const emit = defineEmits<{
  edit: [deck: CommanderDeck]
  delete: [deck: CommanderDeck]
}>()
</script>

<template>
  <div class="flex justify-end items-center gap-2 shrink-0">
    <!-- Edit -->
    <UButton
      size="xs"
      variant="ghost"
      color="neutral"
      :icon="ICONS.edit"
      aria-label="Modifica proprietà"
      @click="emit('edit', deck)"
    />

    <!-- Delete: only shown when not used -->
    <UTooltip v-if="!isUsedInEvents" :text="'Elimina deck'">
      <UButton
        size="xs"
        variant="ghost"
        color="error"
        :icon="ICONS.delete"
        aria-label="Elimina deck"
        @click="emit('delete', deck)"
      />
    </UTooltip>
  </div>
</template>
