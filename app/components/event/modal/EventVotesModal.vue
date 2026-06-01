<!-- app\components\events\modals\EventVotesModal.vue -->
<script setup lang="ts">
import type { TournamentPlayer } from '#shared/utils/types'

const {
  showVotesModal,
  selectedVotesPlayerId,
  getPlayerName,
  votesStore,
  tablePlayersForVotes,
} = defineProps<{
  showVotesModal: boolean
  selectedVotesPlayerId: number | null
  getPlayerName: (playerId: number) => string
  votesStore: ReturnType<typeof import('~/stores/votes').useVotesStore>
  tablePlayersForVotes: TournamentPlayer[]
}>()

const emit = defineEmits<{
  submit: [deckVotePlayerId: number | null, playVotePlayerId: number | null]
  cancel: []
}>()

const open = computed({
  get: () => showVotesModal,
  set: (val) => { if (!val) emit('cancel') },
})
</script>

<template>
  <UModal
    v-model:open="open"
    title="Voti Mazzo e Giocata"
    :description="selectedVotesPlayerId ? getPlayerName(selectedVotesPlayerId) : ''"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <DeckPlayVotesModal
        v-if="selectedVotesPlayerId"
        :player-id="selectedVotesPlayerId"
        :player-name="getPlayerName(selectedVotesPlayerId)"
        :deck-vote-player-id="votesStore.getDeckVote(selectedVotesPlayerId)"
        :play-vote-player-id="votesStore.getPlayVote(selectedVotesPlayerId)"
        :other-players="tablePlayersForVotes"
        @submit="(d, p) => emit('submit', d, p)"
        @cancel="emit('cancel')"
      />
    </template>
  </UModal>
</template>
