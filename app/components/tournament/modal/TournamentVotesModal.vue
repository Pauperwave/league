<!-- app\components\tournament\modal\TournamentVotesModal.vue -->
<script setup lang="ts">
import type DeckPlayVotesModal from '~/components/deck/DeckPlayVotesModal.vue'
import type { Player, Ruleset, TablePlayer } from '#shared/utils/types'

const { t } = useI18n()

const deckVotesRef = useTemplateRef<InstanceType<typeof DeckPlayVotesModal>>('deckVotesRef')

const {
  showVotesModal,
  selectedVotesPlayerId,
  getPlayerName,
  getPlayer,
  votesStore,
  tablePlayersForVotes,
  ruleset = null,
} = defineProps<{
  showVotesModal: boolean
  selectedVotesPlayerId: number | null
  getPlayerName: (playerId: number) => string
  getPlayer: (playerId: number) => Player | undefined
  votesStore: ReturnType<typeof import('~/stores/votes').useVotesStore>
  tablePlayersForVotes: TablePlayer[]
  ruleset?: Ruleset | null
}>()

const emit = defineEmits<{
  submit: [deckVotePlayerId: number | null, playVotePlayerId: number | null]
  cancel: []
  assignCommander: [playerId: number]
}>()

const open = computed({
  get: () => showVotesModal,
  set: (val) => { if (!val) emit('cancel') },
})

// UModal's own opening autofocus (Reka UI's DialogContent, usually landing on
// the close button or the first link in #description) previously got
// preempted here to jump straight into the first vote card instead. That
// backfired: the auto-focus landed on the card *before* the user did
// anything, so their first real Tab press moved past "Mazzo preferito" onto
// "Miglior giocata" instead of landing on the first grid as expected.
// Focusing the dialog's own content element instead (already tabindex="-1"
// per Reka UI) keeps the same deterministic, non-flaky focus target without
// eating the grid's first tab stop. The close button is pulled out of the
// tab order below (`:close="{ tabindex: -1 }"`, still clickable and Escape
// still works) so the user's first Tab lands directly on "Mazzo preferito"
// as the first focusable descendant in DOM order.
function onContentOpenAutoFocus(event: Event) {
  event.preventDefault()
  ;(event.target as HTMLElement | null)?.focus()
}

// `tabindex` isn't part of UModal's typed `close` (ButtonProps) prop, but it
// still falls through to the underlying <button> element at runtime — a
// non-literal binding sidesteps TS's excess-property check on the prop.
const closeButtonProps: Record<string, unknown> = { tabindex: -1 }
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('tournament.votesModal.title')"
    :ui="{ content: 'sm:max-w-4xl' }"
    :content="{ onOpenAutoFocus: onContentOpenAutoFocus }"
    :close="closeButtonProps"
  >
    <template #description>
      <PlayerNameTag
        v-if="selectedVotesPlayerId && getPlayer(selectedVotesPlayerId)"
        :name="getPlayer(selectedVotesPlayerId)!.player_name"
        :surname="getPlayer(selectedVotesPlayerId)!.player_surname"
        :player-id="selectedVotesPlayerId"
        :linkable="false"
        avatar-size="xs"
      />
      <span v-else-if="selectedVotesPlayerId">{{ getPlayerName(selectedVotesPlayerId) }}</span>
    </template>

    <template #body>
      <DeckPlayVotesModal
        v-if="selectedVotesPlayerId"
        ref="deckVotesRef"
        :deck-vote-player-id="votesStore.getDeckVote(selectedVotesPlayerId)"
        :play-vote-player-id="votesStore.getPlayVote(selectedVotesPlayerId)"
        :other-players="tablePlayersForVotes"
        :ruleset="ruleset"
        @submit="(d, p) => emit('submit', d, p)"
        @cancel="emit('cancel')"
        @assign-commander="(playerId) => emit('assignCommander', playerId)"
      />
    </template>

    <template #footer>
      <div class="flex gap-2 justify-end w-full">
        <!-- DOM order (= tab order) is Confirm-then-Cancel — right after the
             last vote card, Tab reaches Salva, with Annulla as the final
             stop — pinned back to its usual on-screen spot (left) via CSS
             `order` so this only changes tab order, not the visual layout. -->
        <ConfirmButton
          class="order-2"
          :label="t('common.save')"
          @click="deckVotesRef?.submit()"
        />
        <CancelButton
          class="order-1"
          @click="emit('cancel')"
        />
      </div>
    </template>
  </UModal>
</template>
