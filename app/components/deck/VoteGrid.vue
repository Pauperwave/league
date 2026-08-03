<!-- app\components\deck\VoteGrid.vue -->
<script setup lang="ts">
import type { TablePlayer } from '#shared/utils/types'

const {
  label,
  weight = null,
  groupAriaLabel,
  keyPrefix,
  otherPlayers,
  selectedId
} = defineProps<{
  label: string
  /** Vote weight badge, shown next to `label` when the ruleset assigns one. */
  weight?: number | null
  groupAriaLabel: string
  /** Prefixes each card's :key so deck/play grids never collide on player id. */
  keyPrefix: string
  otherPlayers: TablePlayer[]
  selectedId: number | null
}>()

const emit = defineEmits<{
  select: [player: TablePlayer, index: number]
  assign: [playerId: number]
}>()

const { t } = useI18n()

// Arrow-key roving tabindex — see useRovingTabindex.ts. Self-contained here
// since it's purely local UI state for this one grid.
const roving = useRovingTabindex(() => otherPlayers.length)

function selectVote(player: TablePlayer, index: number) {
  emit('select', player, index)
  roving.focusIndex(index)
}
</script>

<template>
  <div>
    <div class="flex items-center gap-2 mb-3">
      <label class="text-md font-medium">{{ label }}</label>
      <UBadge
        v-if="weight != null"
        color="info"
        variant="subtle"
        size="md"
      >
        {{ t('deck.votes.weightBadge', { weight }) }}
      </UBadge>
    </div>
    <div
      class="grid grid-cols-2 sm:grid-cols-3 gap-3"
      role="group"
      :aria-label="groupAriaLabel"
    >
      <CommanderVoteCard
        v-for="(player, index) in otherPlayers"
        :key="`${keyPrefix}-${player.id}`"
        :ref="(el) => roving.setItemRef(index, el as { focus: () => void } | null)"
        :commander-name="player.commander1 ?? null"
        :name="player.name"
        :surname="player.surname"
        :avatar-url="player.avatarUrl"
        :player-id="player.id"
        :selected="selectedId === player.id"
        :tabindex="roving.tabindexFor(index)"
        @click="() => selectVote(player, index)"
        @assign="emit('assign', player.id)"
        @navigate="(direction) => roving.onNavigate(index, direction)"
      />
    </div>
  </div>
</template>
