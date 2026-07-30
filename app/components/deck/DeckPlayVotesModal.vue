<!-- app\components\deck\DeckPlayVotesModal.vue -->
<script setup lang="ts">
import type { Ruleset, TablePlayer } from '#shared/utils/types'

const props = defineProps<{
  deckVotePlayerId: number | null
  playVotePlayerId: number | null
  otherPlayers: TablePlayer[]
  ruleset?: Ruleset | null
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

const submitVotesLogging = useButtonLogging('Conferma voti', {
  deckVotePlayerId: () => localDeckVotePlayerId.value,
  playVotePlayerId: () => localPlayVotePlayerId.value,
})

function handleConfirm() {
  submitVotesLogging.logClick()
  emit('submit', localDeckVotePlayerId.value, localPlayVotePlayerId.value)
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="ruleset" class="flex items-center justify-between gap-2 text-xs text-muted">
      <span>{{ t('deck.votes.rulesetLabel', { name: ruleset.name }) }}</span>
      <UTooltip :text="t('deck.votes.rulesetLinkTooltip')">
        <UButton
          color="primary"
          variant="ghost"
          size="xs"
          :icon="ICONS.rules"
          to="/rulesets"
          :aria-label="t('deck.votes.rulesetLinkTooltip')"
        />
      </UTooltip>
    </div>

    <div>
      <div class="flex items-center gap-2 mb-2">
        <label class="text-sm font-medium">{{ t('deck.votes.preferredDeck') }}</label>
        <UBadge v-if="ruleset?.rule_set_brew != null" color="info" variant="subtle" size="sm">
          {{ t('deck.votes.weightBadge', { weight: ruleset.rule_set_brew }) }}
        </UBadge>
      </div>
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
      <div class="flex items-center gap-2 mb-2">
        <label class="text-sm font-medium">{{ t('deck.votes.bestPlay') }}</label>
        <UBadge v-if="ruleset?.rule_set_play != null" color="info" variant="subtle" size="sm">
          {{ t('deck.votes.weightBadge', { weight: ruleset.rule_set_play }) }}
        </UBadge>
      </div>
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
      @confirm="handleConfirm"
    />
  </div>
</template>
