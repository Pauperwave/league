<script setup lang="ts">
import type { TournamentPlayer } from '#shared/utils/types'
import type { PairingPlayerScore, PairingTableScore } from '~/composables/events/pairing/pairingOptimizer'

interface PlayerRow {
  player: TournamentPlayer
  detail?: PairingPlayerScore
}

interface Props {
  selectedTableScore: PairingTableScore | null
  selectedTablePlayerRows: PlayerRow[]
}

defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal
    v-model:open="open"
    title="Dettaglio calcolo tavolo"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div v-if="selectedTableScore" class="space-y-4">
        <TableReceiptSummary :score="selectedTableScore" />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TablePlayerReceiptCard
            v-for="row in selectedTablePlayerRows"
            :key="row.player.id"
            :player="row.player"
            :detail="row.detail"
          />
        </div>
      </div>

      <div v-else class="text-sm text-muted">
        Nessun dettaglio disponibile per questo tavolo.
      </div>
    </template>
  </UModal>
</template>
