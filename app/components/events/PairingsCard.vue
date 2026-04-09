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
  navigateToScore: [pairingId: number, playerId: number, tableIndex: number]
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
            class="flex items-center justify-between p-2 bg-elevated rounded"
          >
            <div class="flex items-center gap-2">
              <UIcon
                :name="hasSubmittedScore(pairing.pairing_id, playerId) ? 'i-lucide-check-circle' : 'i-lucide-circle'"
                :class="hasSubmittedScore(pairing.pairing_id, playerId) ? 'text-success' : 'text-muted'"
              />
              <span>{{ getPlayerName(playerId) }}</span>
            </div>
            <UButton
              :color="hasSubmittedScore(pairing.pairing_id, playerId) ? 'success' : 'primary'"
              size="xs"
              @click="emit('navigateToScore', pairing.pairing_id, playerId, index)"
            >
              {{ hasSubmittedScore(pairing.pairing_id, playerId) ? 'Modifica' : 'Inserisci' }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <UEmpty v-else icon="i-lucide-users" title="Nessun tavolo disponibile" />
  </UCard>
</template>
