<!-- app\components\DeckCardActions.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()
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
      @click="emit('edit', deck)"
    />

    <!-- Delete: only shown when not used -->
    <UTooltip v-if="!isUsedInEvents" :text="t('deck.cardActions.deleteTooltip')">
      <UButton
        size="xs"
        variant="ghost"
        color="error"
        :icon="ICONS.delete"
        :aria-label="t('deck.cardActions.deleteAriaLabel')"
        @click="emit('delete', deck)"
      />
    </UTooltip>
  </div>
</template>
