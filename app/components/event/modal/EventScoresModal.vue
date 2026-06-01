<!-- app\components\events\modals\EventScoresModal.vue -->
<script setup lang="ts">
import type { PairingWithResults, TournamentPlayer } from '#shared/utils/types'

const {
  showScoresModal,
  selectedScoresPairingId,
  pairings,
  tournamentPlayers,
  rankingsStore,
  killsStore,
  votesStore,
} = defineProps<{
  showScoresModal: boolean
  selectedScoresPairingId: number | null
  pairings: PairingWithResults[]
  tournamentPlayers: TournamentPlayer[]
  rankingsStore: ReturnType<typeof import('~/stores/rankings').useRankingsStore>
  killsStore: ReturnType<typeof import('~/stores/kills').useKillsStore>
  votesStore: ReturnType<typeof import('~/stores/votes').useVotesStore>
}>()

const open = computed({
  get: () => showScoresModal,
  set: () => {}, // no-op; parent controls via v-model:open binding
})

const pairing = computed(() =>
  selectedScoresPairingId !== null
    ? pairings.find(p => p.pairing_id === selectedScoresPairingId) ?? null
    : null
)
</script>

<template>
  <UModal
    v-model:open="open"
    title="Punteggi Tavolo"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <TableScoresModal
        :pairing="pairing"
        :all-players="tournamentPlayers"
        :rankings="rankingsStore"
        :kills-store="killsStore"
        :votes-store="votesStore"
      />
    </template>
  </UModal>
</template>
