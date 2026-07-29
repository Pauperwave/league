<!-- app\components\deck\DeckPlayVotesModal.vue -->
<script setup lang="ts">
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
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="player in otherPlayers"
          :key="`deck-${player.id}`"
          :variant="localDeckVotePlayerId === player.id ? 'solid' : 'outline'"
          :color="localDeckVotePlayerId === player.id ? 'primary' : 'neutral'"
          class="h-auto"
          @click="() => { localDeckVotePlayerId = player.id }"
        >
          <UAvatar size="xs" :src="player.avatarUrl || generatePlayerAvatar(player.id)" :alt="player.name" />
          <span class="flex flex-col items-start leading-tight text-left">
            <span>{{ player.name }}</span>
            <span class="font-semibold">{{ player.surname }}</span>
          </span>
        </UButton>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-2">{{ t('deck.votes.bestPlay') }}</label>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="player in otherPlayers"
          :key="`play-${player.id}`"
          :variant="localPlayVotePlayerId === player.id ? 'solid' : 'outline'"
          :color="localPlayVotePlayerId === player.id ? 'primary' : 'neutral'"
          class="h-auto"
          @click="() => { localPlayVotePlayerId = player.id }"
        >
          <UAvatar size="xs" :src="player.avatarUrl || generatePlayerAvatar(player.id)" :alt="player.name" />
          <span class="flex flex-col items-start leading-tight text-left">
            <span>{{ player.name }}</span>
            <span class="font-semibold">{{ player.surname }}</span>
          </span>
        </UButton>
      </div>
    </div>

    <ModalFooterActions
      :confirm-label="t('common.save')"
      @cancel="emit('cancel')"
      @confirm="emit('submit', localDeckVotePlayerId, localPlayVotePlayerId)"
    />
  </div>
</template>
