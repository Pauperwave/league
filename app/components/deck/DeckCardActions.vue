<!-- app\components\deck\DeckCardActions.vue -->
<script setup lang="ts">
import type { CommanderDeck } from '#shared/utils/types'

const props = defineProps<{
  deck: CommanderDeck
  isUsedInTournaments: boolean
}>()

const emit = defineEmits<{
  edit: [deck: CommanderDeck]
  delete: [deck: CommanderDeck]
}>()

const { t } = useI18n()

const editLogging = useButtonLogging('Modifica mazzo', { deckId: () => props.deck.id })
const deleteLogging = useButtonLogging('Elimina mazzo', { deckId: () => props.deck.id })

function handleEdit() {
  editLogging.logClick()
  emit('edit', props.deck)
}

function handleDelete() {
  deleteLogging.logClick()
  emit('delete', props.deck)
}
</script>

<template>
  <div class="flex justify-end items-center gap-2 shrink-0">
    <!-- Edit -->
    <UButton
      size="xs"
      variant="ghost"
      color="neutral"
      :icon="ICONS.edit"
      :aria-label="t('deck.cardActions.editAriaLabel')"
      @click="handleEdit"
    />

    <!-- Delete: only shown when not used -->
    <UTooltip v-if="!isUsedInTournaments" :text="t('deck.cardActions.deleteTooltip')">
      <UButton
        size="xs"
        variant="ghost"
        color="error"
        :icon="ICONS.delete"
        :aria-label="t('deck.cardActions.deleteAriaLabel')"
        @click="handleDelete"
      />
    </UTooltip>
  </div>
</template>
