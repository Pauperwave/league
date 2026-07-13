<!-- app\components\event\pairing\table\TableCardActions.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
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
  <div class="flex items-center gap-2">
    <h3 class="font-semibold">
      {{ t('event.pairing.tableHeading', { n: tableIndex + 1 }) }}
    </h3>
    <UTooltip :key="`punteggi-${pairing.pairing_id}`" :content="{ side: 'top' }" :text="t('event.pairing.viewScoresTooltip')">
      <UButton
        size="xs"
        variant="outline"
        :label="t('event.pairing.scoresButtonLabel')"
        :trailing-icon="ICONS.show"
        @click="emit('viewScores', pairing.pairing_id)"
      />
    </UTooltip>
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
    <UTooltip :key="`fill-${pairing.pairing_id}`" :content="{ side: 'top' }" :text="t('event.pairing.fillConfirm.title')">
      <UButton
        size="xs"
        variant="outline"
        color="warning"
        :icon="ICONS.quickAction"
        :aria-label="t('event.pairing.quickFillAriaLabel')"
        @click="emit('quickFill', pairing)"
      />
    </UTooltip>
    <TableStateBadge :is-complete="isComplete" />
  </div>
</template>
