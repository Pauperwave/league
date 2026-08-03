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
  /** A voted-on player has no commander recorded yet — opens the commander-assignment modal for them. */
  assignCommander: [playerId: number]
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

const submitVotesLogging = useButtonLogging(t('logging.tournament.confirmVotes'), {
  deckVotePlayerId: () => localDeckVotePlayerId.value,
  playVotePlayerId: () => localPlayVotePlayerId.value,
})

function handleConfirm() {
  submitVotesLogging.logClick()
  emit('submit', localDeckVotePlayerId.value, localPlayVotePlayerId.value)
}

function onAssignCommander(playerId: number) {
  emit('assignCommander', playerId)
}

// Footer lives in the parent (TournamentVotesModal's #footer slot, see
// CommanderModal.vue for the same submit/canSubmit exposure pattern) — this
// lets the confirm button sit in UModal's actual footer instead of at the
// end of the body content.
defineExpose({ submit: handleConfirm })
</script>

<template>
  <div class="space-y-6">
    <VoteGrid
      :label="t('deck.votes.preferredDeck')"
      :weight="ruleset?.rule_set_brew ?? null"
      :group-aria-label="t('deck.votes.preferredDeck')"
      key-prefix="deck"
      :other-players="otherPlayers"
      :selected-id="localDeckVotePlayerId"
      @select="(player) => localDeckVotePlayerId = player.id"
      @assign="onAssignCommander"
    />
    <VoteGrid
      :label="t('deck.votes.bestPlay')"
      :weight="ruleset?.rule_set_play ?? null"
      :group-aria-label="t('deck.votes.bestPlay')"
      key-prefix="play"
      :other-players="otherPlayers"
      :selected-id="localPlayVotePlayerId"
      @select="(player) => localPlayVotePlayerId = player.id"
      @assign="onAssignCommander"
    />
  </div>
</template>
