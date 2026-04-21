<!-- app\components\Events\PairingsCard.vue -->
<script setup lang="ts">
import type { Pairing } from '#shared/utils/types'

interface Props {
  pairings: Pairing[]
  currentRound: number | null
  getPlayerName: (playerId: number) => string
  hasSubmittedScore: (pairingId: number, playerId: number) => boolean
}

defineProps<Props>()

const emit = defineEmits<{
  openScoreModal: [pairingId: number, tableIndex: number]
}>()

const pairingPlayerIds = (pairing: Pairing): number[] =>
  [pairing.pairing_player1_id, pairing.pairing_player2_id, pairing.pairing_player3_id, pairing.pairing_player4_id]
    .filter((id): id is number => !!id)
</script>

<template>
  <UCard variant="outline">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-layout-grid" class="size-5 text-primary" />
        <h2 class="text-lg font-semibold">Tavoli</h2>
      </div>
    </template>

    <div v-if="pairings.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="(pairing, index) in pairings"
        :key="pairing.pairing_id"
        class="bg-muted/30 rounded-lg p-4"
      >
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-table-2" class="size-4 text-muted" />
            Tavolo {{ index + 1 }}
          </h3>
          <UBadge size="sm" variant="subtle">Round {{ currentRound }}</UBadge>
        </div>

        <div class="space-y-2">
          <div
            v-for="playerId in pairingPlayerIds(pairing)"
            :key="playerId"
            class="flex items-center gap-2 p-2 bg-elevated rounded"
          >
            <UIcon name="i-lucide-user" class="size-4 text-muted" />
            <span>{{ getPlayerName(playerId) }}</span>
          </div>
        </div>

        <UButton
          color="primary"
          size="sm"
          block
          class="mt-3"
          @click="emit('openScoreModal', pairing.pairing_id, index)"
        >
          Inserisci Punteggi
        </UButton>
      </div>
    </div>

    <UEmpty v-else icon="i-lucide-users" title="Nessun tavolo disponibile" />
  </UCard>
</template>
