<script setup lang="ts">
import type { TournamentPlayer } from '#shared/utils/types'
import type { PairingPlayerScore } from '~/composables/tables/pairingOptimizer'

interface Props {
  player: TournamentPlayer
  detail?: PairingPlayerScore
}

defineProps<Props>()

function formatScore(value: number): string {
  return value.toFixed(2)
}
</script>

<template>
  <div class="rounded border border-default/70 bg-muted/10 p-3 space-y-2">
    <div class="flex items-start justify-between gap-2 border-b border-default/60 pb-1.5">
      <div class="font-medium leading-tight">
        {{ player.name }}
      </div>
      <span class="text-xs font-mono text-muted">#{{ player.id }}</span>
    </div>

    <div v-if="detail" class="space-y-1 text-xs">
      <div class="flex items-center justify-between gap-2">
        <span class="text-muted">Bilanciamento</span>
        <span class="font-mono">{{ formatScore(detail.strengthBalance) }}</span>
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-muted">Novità</span>
        <span class="font-mono">{{ formatScore(detail.novelty) }}</span>
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-muted">Rematch</span>
        <span class="font-mono">{{ formatScore(detail.rematchPenalty) }}</span>
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-muted">Rotazione tavoli da 3</span>
        <span class="font-mono">{{ formatScore(detail.rotateTable3) }}</span>
      </div>
      <div class="flex items-center justify-between gap-2 border-b border-dashed border-default/60 pb-1">
        <span class="text-muted">Peso dimensione tavolo</span>
        <span class="font-mono">{{ formatScore(detail.tableSizeWeight) }}</span>
      </div>
      <div class="flex items-center justify-between gap-2 font-semibold">
        <span>Totale</span>
        <span class="font-mono">{{ formatScore(detail.total) }}</span>
      </div>
    </div>
  </div>
</template>
