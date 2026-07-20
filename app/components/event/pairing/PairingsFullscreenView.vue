<!-- app\components\event\pairing\PairingsFullscreenView.vue -->
<script setup lang="ts">
// A dedicated big-display readout of the current round's tables — table
// number + surnames only, meant to be read across a room (projector/TV),
// not interacted with. Separate from PairingsCard.vue on purpose: that
// component owns the editable table cards and all their modals/actions,
// this one is pure display.
import type { Pairing, TournamentPlayer } from '#shared/utils/types'

const { pairings, allPlayers } = defineProps<{
  pairings: Pairing[]
  allPlayers: TournamentPlayer[]
}>()

const emit = defineEmits<{ exit: [] }>()

const { t } = useI18n()

const pairingPlayerIds = (pairing: Pairing): number[] =>
  [
    pairing.pairing_player1_id,
    pairing.pairing_player2_id,
    pairing.pairing_player3_id,
    pairing.pairing_player4_id
  ].filter((id): id is number => !!id)

// O(1) lookup instead of allPlayers.find() per player per render — matters
// once a tournament has enough players for this to run many times a frame.
const playersById = computed(() => new Map(allPlayers.map(p => [p.id, p])))

/**
 * Resolves a pairing's seats to display labels in one pass — surname and
 * initial ("N.") kept separate so the template can render the initial
 * muted, surname full-weight. Surname alone can collide (families/clubs
 * sharing one), hence the initial at all.
 */
function tablePlayers(pairing: Pairing): { id: number, surname: string, initial: string }[] {
  return pairingPlayerIds(pairing).map((id) => {
    const player = playersById.value.get(id)
    return {
      id,
      surname: player?.surname ?? '',
      initial: player?.name ? `${player.name.charAt(0)}.` : '',
    }
  })
}

/**
 * Roughly-square column count so N tables actually spread across the
 * available space instead of always defaulting to a fixed count regardless
 * of how many tables there are.
 */
const columns = computed(() => Math.max(1, Math.ceil(Math.sqrt(pairings.length))))
</script>

<template>
  <div class="relative h-screen w-screen bg-default overflow-hidden">
    <!-- Absolutely positioned, not a reserved header strip — with many
         tables (e.g. a 40-player/10-table event) every row of grid height
         matters; a dedicated header row was pushing the last grid row off
         screen. -->
    <UTooltip :content="{ side: 'top' }" :text="t('event.pairing.exitFullscreenTooltip')">
      <UButton
        :icon="ICONS.collapse"
        color="neutral"
        variant="ghost"
        class="absolute top-2 right-2 z-10"
        :aria-label="t('event.pairing.exitFullscreenTooltip')"
        @click="emit('exit')"
      />
    </UTooltip>

    <!-- border-dashed on the grid + each cell: visible construction lines so
         the layout structure (columns/rows actually assigned) can be
         inspected directly, not just guessed from the class list. -->
    <div
      class="h-full w-full grid gap-2 p-4 border border-dashed border-default"
      :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: '1fr' }"
    >
      <!-- [container-type:size] per cell (not on the page root): cqmin here
           scales to each table's own allotted grid area, which shrinks as
           table count grows — so text always fits its row instead of
           overflowing/getting cut off once there are enough tables that a
           page-relative size stops fitting. -->
      <div
        v-for="(pairing, index) in pairings"
        :key="pairing.pairing_id"
        class="flex items-start justify-start gap-[4cqmin] border border-dashed border-default [container-type:size] overflow-hidden"
      >
        <!-- Fixed min-width, right-aligned: keeps every number's right edge
             (and the surnames starting right after it) on the same vertical
             line down each column, regardless of 1 vs 2-digit table counts. -->
        <div class="text-[38cqmin] font-bold text-warning leading-none min-w-[46cqmin] text-right">{{ index + 1 }}</div>
        <div class="flex flex-col gap-[1.5cqmin] min-w-0">
          <span
            v-for="player in tablePlayers(pairing)"
            :key="player.id"
            class="text-[17cqmin] font-semibold leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
          >
            {{ player.surname }} <span class="text-muted font-normal">{{ player.initial }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
