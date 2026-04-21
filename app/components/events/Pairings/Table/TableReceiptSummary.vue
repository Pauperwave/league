<script setup lang="ts">
import type { PairingTableScore } from '~/composables/events/pairing/pairingOptimizer'

interface Props {
  score: PairingTableScore
}

defineProps<Props>()

function formatScore(value: number): string {
  return value.toFixed(2)
}
</script>

<template>
  <div class="rounded border border-default/70 bg-muted/20 p-3 space-y-1 text-xs">
    <div class="flex items-center justify-between gap-2">
      <span class="text-muted">Bilanciamento</span>
      <span class="font-mono">{{ formatScore(score.strengthBalance) }}</span>
    </div>
    <div class="flex items-center justify-between gap-2">
      <span class="text-muted">Novità</span>
      <span class="font-mono">{{ formatScore(score.novelty) }}</span>
    </div>
    <div class="flex items-center justify-between gap-2">
      <span class="text-muted">Rematch</span>
      <span class="font-mono">{{ formatScore(score.rematchPenalty) }}</span>
    </div>
    <div class="flex items-center justify-between gap-2">
      <span class="text-muted">Rotazione tavoli da 3</span>
      <span class="font-mono">{{ formatScore(score.rotateTable3) }}</span>
    </div>
    <div class="flex items-center justify-between gap-2 border-b border-dashed border-default/60 pb-1">
      <span class="text-muted">Peso dimensione tavolo</span>
      <span class="font-mono">{{ formatScore(score.tableSizeWeight) }}</span>
    </div>
    <div class="flex items-center justify-between gap-2 font-semibold text-sm">
      <span>Totale tavolo</span>
      <span class="font-mono">{{ formatScore(score.total) }}</span>
    </div>
  </div>
</template>
