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
</script>

<template>
  <div class="flex gap-2">
    <!-- Rankings button — locked while the table is marked as a draw, since
         editing it would silently un-draw the table with no other signal. -->
    <UTooltip :content="{ side: 'top' }" :text="isDraw ? t('event.pairing.drawnTooltip') : (hasRanking ? t('event.pairing.rankingSetTooltip') : t('event.pairing.rankingNotSetTooltip'))">
      <UButton
        :color="hasRanking ? 'success' : 'neutral'"
        class="flex-1"
        :icon="ICONS.standings"
        variant="outline"
        :disabled="isDraw"
        @click="emit('openScoreModal', pairingId, tableIndex)"
      >
        {{ t('event.pairing.rankingButton') }}
      </UButton>
    </UTooltip>

    <!-- Kills entry button — same lock as above. -->
    <UTooltip :content="{ side: 'top' }" :text="isDraw ? t('event.pairing.drawnTooltip') : (hasKills ? t('event.pairing.killsSetTooltip') : t('event.pairing.killsNotSetTooltip'))">
      <UButton
        :color="hasKills ? 'success' : 'neutral'"
        class="flex-1"
        :icon="ICONS.kills"
        variant="outline"
        :disabled="isDraw"
        @click="emit('openKillModal', pairingId)"
      >
        {{ t('event.pairing.killsButton') }}
      </UButton>
    </UTooltip>

    <!-- Draw ("Patta") — sits outside both the ranking and kills modals since
         it sets both at once (zero kills, everyone tied for first). Disabled
         once ranking/kills already hold real data (would silently discard
         it) unless the table is already a draw, in which case pressing it
         again toggles the draw back off. -->
    <UTooltip :content="{ side: 'top' }" :text="isDraw ? t('event.pairing.drawUndoTooltip') : (canToggleDraw ? t('event.killModal.drawHint') : t('event.pairing.drawDisabledTooltip'))">
      <UButton
        :color="isDraw ? 'success' : 'neutral'"
        class="flex-1"
        :icon="ICONS.draw"
        variant="outline"
        :disabled="!canToggleDraw"
        @click="emit('draw', pairingId)"
      >
        {{ t('event.pairing.drawButton') }}
      </UButton>
    </UTooltip>
  </div>
</template>
