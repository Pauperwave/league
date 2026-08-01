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

// Arrow-key roving tabindex — see useRovingTabindex.ts. One instance per
// grid, since each is its own independent radiogroup-like widget.
const deckRoving = useRovingTabindex(() => props.otherPlayers.length)
const playRoving = useRovingTabindex(() => props.otherPlayers.length)

// Footer lives in the parent (TournamentVotesModal's #footer slot, see
// CommanderModal.vue for the same submit/canSubmit exposure pattern) — this
// lets the confirm button sit in UModal's actual footer instead of at the
// end of the body content.
defineExpose({ submit: handleConfirm })
</script>

<template>
  <div class="space-y-6">
    <div>
      <div class="flex items-center gap-2 mb-3">
        <label class="text-md font-medium">{{ t('deck.votes.preferredDeck') }}</label>
        <UBadge v-if="ruleset?.rule_set_brew != null" color="info" variant="subtle" size="md">
          {{ t('deck.votes.weightBadge', { weight: ruleset.rule_set_brew }) }}
        </UBadge>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3" role="group" :aria-label="t('deck.votes.preferredDeck')">
        <CommanderVoteCard
          v-for="(player, index) in otherPlayers"
          :key="`deck-${player.id}`"
          :ref="(el) => deckRoving.setItemRef(index, el as { focus: () => void } | null)"
          :commander-name="player.commander1 ?? null"
          :name="player.name"
          :surname="player.surname"
          :avatar-url="player.avatarUrl"
          :player-id="player.id"
          :selected="localDeckVotePlayerId === player.id"
          :tabindex="deckRoving.tabindexFor(index)"
          @click="() => { localDeckVotePlayerId = player.id; deckRoving.focusIndex(index) }"
          @assign="emit('assignCommander', player.id)"
          @navigate="(direction) => deckRoving.onNavigate(index, direction)"
        />
      </div>
    </div>

    <div>
      <div class="flex items-center gap-2 mb-3">
        <label class="text-md font-medium">{{ t('deck.votes.bestPlay') }}</label>
        <UBadge v-if="ruleset?.rule_set_play != null" color="info" variant="subtle" size="md">
          {{ t('deck.votes.weightBadge', { weight: ruleset.rule_set_play }) }}
        </UBadge>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3" role="group" :aria-label="t('deck.votes.bestPlay')">
        <CommanderVoteCard
          v-for="(player, index) in otherPlayers"
          :key="`play-${player.id}`"
          :ref="(el) => playRoving.setItemRef(index, el as { focus: () => void } | null)"
          :commander-name="player.commander1 ?? null"
          :name="player.name"
          :surname="player.surname"
          :avatar-url="player.avatarUrl"
          :player-id="player.id"
          :selected="localPlayVotePlayerId === player.id"
          :tabindex="playRoving.tabindexFor(index)"
          @click="() => { localPlayVotePlayerId = player.id; playRoving.focusIndex(index) }"
          @assign="emit('assignCommander', player.id)"
          @navigate="(direction) => playRoving.onNavigate(index, direction)"
        />
      </div>
    </div>
  </div>
</template>
