<!-- app\components\events\modals\EventScoreModal.vue -->
<script setup lang="ts">
import type { PairingWithResults, Player } from '#shared/utils/types'

const {
  showScoreModal,
  selectedPairingId,
  selectedTableIndex,
  pairings,
  allPlayers,
  rankingsStore,
  getPlayerName,
} = defineProps<{
  showScoreModal: boolean
  selectedPairingId: number | null
  selectedTableIndex: number | null
  pairings: PairingWithResults[]
  allPlayers: Player[]
  rankingsStore: ReturnType<typeof import('~/stores/rankings').useRankingsStore>
  getPlayerName: (playerId: number) => string
}>()

const emit = defineEmits<{
  submit: [ranking: number[], rankingWithRanks: { playerId: number; rank: number }[]]
  cancel: []
}>()

const pairing = computed(() =>
  selectedPairingId !== null
    ? pairings.find(p => p.pairing_id === selectedPairingId) ?? null
    : null
)

const savedRankingWithRanks = computed(() =>
  selectedPairingId !== null
    ? rankingsStore.getRankingWithRanks(selectedPairingId)
    : undefined
)

const open = computed({
  get: () => showScoreModal,
  set: (val) => { if (!val) emit('cancel') },
})
</script>

<template>
  <UModal
    v-model:open="open"
    title="Inserisci classifica"
    :description="`Tavolo ${selectedTableIndex !== null ? selectedTableIndex + 1 : ''}`"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <TableScoreGrid
        :pairing="pairing"
        :get-player-name="getPlayerName"
        :all-players="allPlayers"
        :saved-ranking-with-ranks="savedRankingWithRanks"
        @submit="(r, rw) => emit('submit', r, rw)"
        @cancel="emit('cancel')"
      />
    </template>
  </UModal>
</template>
