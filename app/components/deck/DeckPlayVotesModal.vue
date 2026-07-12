<!-- app\components\modals\DeckPlayVotesModal.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TournamentPlayer } from '#shared/utils/types'

const props = defineProps<{
  deckVotePlayerId: number | null
  playVotePlayerId: number | null
  otherPlayers: TournamentPlayer[]
}>()

const emit = defineEmits<{
  submit: [deckVotePlayerId: number | null, playVotePlayerId: number | null]
  cancel: []
}>()

const { t } = useI18n()

const localDeckVotePlayerId = ref(props.deckVotePlayerId)
const localPlayVotePlayerId = ref(props.playVotePlayerId)

watch(
  [() => props.deckVotePlayerId, () => props.playVotePlayerId],
  ([deck, play]) => {
    localDeckVotePlayerId.value = deck
    localPlayVotePlayerId.value = play
  }
)
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-2">{{ t('deck.votes.preferredDeck') }}</label>
      <div class="flex gap-2">
        <UButton
          v-for="player in otherPlayers"
          :key="`deck-${player.id}`"
          :variant="localDeckVotePlayerId === player.id ? 'solid' : 'outline'"
          :color="localDeckVotePlayerId === player.id ? 'primary' : 'neutral'"
          @click="() => { localDeckVotePlayerId = player.id }"
        >
          {{ `${player.name} ${player.surname}` }}
        </UButton>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-2">{{ t('deck.votes.bestPlay') }}</label>
      <div class="flex gap-2">
        <UButton
          v-for="player in otherPlayers"
          :key="`play-${player.id}`"
          :variant="localPlayVotePlayerId === player.id ? 'solid' : 'outline'"
          :color="localPlayVotePlayerId === player.id ? 'primary' : 'neutral'"
          @click="() => { localPlayVotePlayerId = player.id }"
        >
          {{ `${player.name} ${player.surname}` }}
        </UButton>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-4">
      <UButton :label="t('common.cancel')" variant="outline" @click="emit('cancel')" />
      <UButton :label="t('common.save')" color="primary" @click="emit('submit', localDeckVotePlayerId, localPlayVotePlayerId)" />
    </div>
  </div>
</template>
