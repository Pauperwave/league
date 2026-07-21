<!-- app\components\event\pairing\table\TableCardActions.vue -->
<script setup lang="ts">
import type { Pairing } from '#shared/utils/types'

const { t } = useI18n()

defineProps<{
  pairing: Pairing
  tableIndex: number
  isComplete: boolean
}>()

const emit = defineEmits<{
  viewScores: [pairingId: number]
  resetTable: [pairingId: number]
  quickFill: [pairing: Pairing]
}>()
</script>

<template>
  <div class="flex items-center gap-2 @container">
    <div class="flex items-center gap-1.5">
      <UIcon :name="ICONS.tableView" class="size-4 text-primary" />
      <h3 class="font-semibold whitespace-nowrap">{{ t('event.pairing.tableHeading', { n: tableIndex + 1 }) }}</h3>
    </div>
    <UTooltip :key="`punteggi-${pairing.pairing_id}`" :content="{ side: 'top' }" :text="t('event.pairing.viewScoresTooltip')">
      <UButton
        size="xs"
        variant="outline"
        :leading-icon="ICONS.show"
        @click="emit('viewScores', pairing.pairing_id)"
      >
        <span class="hidden @sm:inline whitespace-nowrap">{{ t('event.pairing.scoresButtonLabel') }}</span>
      </UButton>
    </UTooltip>

    <div class="flex-1" />

    <UTooltip :key="`reset-${pairing.pairing_id}`" :content="{ side: 'top' }" :text="t('event.pairing.resetTableTooltip')">
      <UButton
        size="xs"
        variant="outline"
        color="error"
        :icon="ICONS.reset"
        :aria-label="t('event.pairing.resetTableTooltip')"
        @click="emit('resetTable', pairing.pairing_id)"
      />
    </UTooltip>
    <QuickFillButton
      :tooltip="t('event.pairing.fillConfirm.title')"
      :aria-label="t('event.pairing.quickFillAriaLabel')"
      @click="emit('quickFill', pairing)"
    />
    <TableStateBadge :is-complete="isComplete" />
  </div>
</template>
