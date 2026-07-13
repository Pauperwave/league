<!-- app\components\event\pairing\table\TableReceiptSummary.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PairingTableScore } from '~/composables/event-pairing/pairingOptimizer'

defineProps<{
  score: PairingTableScore
}>()

const { t } = useI18n()

function formatScore(value: number): string {
  return value.toFixed(2)
}
</script>

<template>
  <div class="rounded border border-default/70 bg-muted/20 p-3 space-y-1 text-xs">
    <div class="flex items-center justify-between gap-2">
      <span class="text-muted">{{ t('event.scoreBreakdown.strengthBalance') }}</span>
      <span class="font-mono">{{ formatScore(score.strengthBalance) }}</span>
    </div>
    <div class="flex items-center justify-between gap-2">
      <span class="text-muted">{{ t('event.scoreBreakdown.novelty') }}</span>
      <span class="font-mono">{{ formatScore(score.novelty) }}</span>
    </div>
    <div class="flex items-center justify-between gap-2">
      <span class="text-muted">{{ t('event.scoreBreakdown.rematch') }}</span>
      <span class="font-mono">{{ formatScore(score.rematchPenalty) }}</span>
    </div>
    <div class="flex items-center justify-between gap-2">
      <span class="text-muted">{{ t('event.tablePreview.scoreItems.rotateTable3') }}</span>
      <span class="font-mono">{{ formatScore(score.rotateTable3) }}</span>
    </div>
    <div class="flex items-center justify-between gap-2 border-b border-dashed border-default/60 pb-1">
      <span class="text-muted">{{ t('event.scoreBreakdown.tableSizeWeight') }}</span>
      <span class="font-mono">{{ formatScore(score.tableSizeWeight) }}</span>
    </div>
    <div class="flex items-center justify-between gap-2 font-semibold text-sm">
      <span>{{ t('event.scoreBreakdown.tableTotal') }}</span>
      <span class="font-mono">{{ formatScore(score.total) }}</span>
    </div>
  </div>
</template>
