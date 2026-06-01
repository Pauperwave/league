<!-- app\components\events\Pairings\TableCardActions.vue -->
<script setup lang="ts">
import type { Pairing } from '#shared/utils/types'

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
      Tavolo {{ tableIndex + 1 }}
    </h3>
    <UTooltip :key="`punteggi-${pairing.pairing_id}`" :content="{ side: 'top' }" text="Visualizza punteggi">
      <UButton
        size="xs"
        variant="outline"
        label="Punteggi"
        trailing-icon="i-lucide-eye"
        @click="emit('viewScores', pairing.pairing_id)"
      />
    </UTooltip>
    <UTooltip :key="`reset-${pairing.pairing_id}`" :content="{ side: 'top' }" text="Resetta tavolo">
      <UButton
        size="xs"
        variant="outline"
        color="error"
        icon="i-lucide-rotate-ccw"
        aria-label="Resetta tavolo"
        @click="emit('resetTable', pairing.pairing_id)"
      />
    </UTooltip>
    <UTooltip :key="`fill-${pairing.pairing_id}`" :content="{ side: 'top' }" text="Compila con dati di test">
      <UButton
        size="xs"
        variant="outline"
        color="warning"
        icon="i-lucide-bolt"
        aria-label="Compila test"
        @click="emit('quickFill', pairing)"
      />
    </UTooltip>
    <TableStateBadge :is-complete="isComplete" />
  </div>
</template>
