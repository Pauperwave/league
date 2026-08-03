<!-- app\components\tournament\pairing\table\PairingTableActions.vue -->
<script setup lang="ts">

const { t } = useI18n()

const props = defineProps<{
  pairingId: number
  tableIndex: number
  hasRanking: boolean
  hasKills: boolean
  isDraw: boolean
}>()

// Declaring a draw over already-entered data would silently discard it —
// only allowed on an empty table, or as a toggle-off from an existing draw.
const canToggleDraw = computed(() => props.isDraw || (!props.hasRanking && !props.hasKills))

const emit = defineEmits<{
  openScoreModal: [pairingId: number, tableIndex: number]
  openKillModal: [pairingId: number]
  /** "Patta" — declares a draw for this table (no kills, everyone ties for first). */
  draw: [pairingId: number]
}>()

// Rankings/kills buttons lock while the table is marked as a draw, since
// editing either would silently un-draw the table with no other signal.
const rankingTooltip = computed(() => {
  if (props.isDraw) return t('tournament.pairing.drawnTooltip')
  return props.hasRanking
    ? t('tournament.pairing.rankingSetTooltip')
    : t('tournament.pairing.rankingNotSetTooltip')
})

const killsTooltip = computed(() => {
  if (props.isDraw) return t('tournament.pairing.drawnTooltip')
  return props.hasKills
    ? t('tournament.pairing.killsSetTooltip')
    : t('tournament.pairing.killsNotSetTooltip')
})

// Draw ("Patta") sits outside both the ranking and kills modals since it
// sets both at once (zero kills, everyone tied for first). Disabled once
// ranking/kills already hold real data (would silently discard it) unless
// the table is already a draw, in which case pressing it again toggles the
// draw back off.
const drawTooltip = computed(() => {
  if (props.isDraw) return t('tournament.pairing.drawUndoTooltip')
  return canToggleDraw.value
    ? t('tournament.killModal.drawHint')
    : t('tournament.pairing.drawDisabledTooltip')
})
</script>

<template>
  <div class="flex gap-2">
    <PairingActionButton
      :tooltip-text="rankingTooltip"
      :color="hasRanking ? 'success' : 'neutral'"
      :icon="ICONS.standings"
      :disabled="isDraw"
      :label="t('tournament.pairing.rankingButton')"
      @click="emit('openScoreModal', pairingId, tableIndex)"
    />
    <PairingActionButton
      :tooltip-text="killsTooltip"
      :color="hasKills ? 'success' : 'neutral'"
      :icon="ICONS.kills"
      :disabled="isDraw"
      :label="t('tournament.pairing.killsButton')"
      @click="emit('openKillModal', pairingId)"
    />
    <PairingActionButton
      :tooltip-text="drawTooltip"
      :color="isDraw ? 'success' : 'neutral'"
      :icon="ICONS.draw"
      :disabled="!canToggleDraw"
      :label="t('tournament.pairing.drawButton')"
      @click="emit('draw', pairingId)"
    />
  </div>
</template>
