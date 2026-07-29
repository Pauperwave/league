<!-- app\components\event\modal\EventVotesModal.vue -->
<script setup lang="ts">
import type { Player, TournamentPlayer } from '#shared/utils/types'

const { t } = useI18n()

const {
  showVotesModal,
  selectedVotesPlayerId,
  getPlayerName,
  getPlayer,
  votesStore,
  tablePlayersForVotes,
} = defineProps<{
  showVotesModal: boolean
  selectedVotesPlayerId: number | null
  getPlayerName: (playerId: number) => string
  getPlayer: (playerId: number) => Player | undefined
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
    :title="t('event.votesModal.title')"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #description>
      <PlayerNameTag
        v-if="selectedVotesPlayerId && getPlayer(selectedVotesPlayerId)"
        :name="getPlayer(selectedVotesPlayerId)!.player_name"
        :surname="getPlayer(selectedVotesPlayerId)!.player_surname"
        :player-id="selectedVotesPlayerId"
        avatar-size="xs"
      />
      <span v-else-if="selectedVotesPlayerId">{{ getPlayerName(selectedVotesPlayerId) }}</span>
    </template>

    <template #body>
      <DeckPlayVotesModal
        v-if="selectedVotesPlayerId"
        :deck-vote-player-id="votesStore.getDeckVote(selectedVotesPlayerId)"
        :play-vote-player-id="votesStore.getPlayVote(selectedVotesPlayerId)"
        :other-players="tablePlayersForVotes"
        @submit="(d, p) => emit('submit', d, p)"
        @cancel="emit('cancel')"
      />
    </template>
  </UModal>
</template>
