<!-- app\components\event\pairing\table\PairingTableActions.vue -->
<script setup lang="ts">

const { t } = useI18n()

defineProps<{
  pairingId: number
  tableIndex: number
  hasRanking: boolean
  hasKills: boolean
}>()

const emit = defineEmits<{
  openScoreModal: [pairingId: number, tableIndex: number]
  openKillModal: [pairingId: number]
  /** "Patta" — declares a draw for this table (no kills, everyone ties for first). */
  draw: [pairingId: number]
}>()
</script>

<template>
  <div class="flex gap-2 mt-3">
    <!-- Rankings button -->
    <UTooltip :content="{ side: 'top' }" :text="hasRanking ? t('event.pairing.rankingSetTooltip') : t('event.pairing.rankingNotSetTooltip')">
      <UButton
        :color="hasRanking ? 'success' : 'neutral'"
        class="flex-1"
        :icon="ICONS.standings"
        variant="outline"
        @click="emit('openScoreModal', pairingId, tableIndex)"
      >
        {{ t('event.pairing.rankingButton') }}
      </UButton>
    </UTooltip>

    <!-- Kills entry button -->
    <UTooltip :content="{ side: 'top' }" :text="hasKills ? t('event.pairing.killsSetTooltip') : t('event.pairing.killsNotSetTooltip')">
      <UButton
        :color="hasKills ? 'success' : 'neutral'"
        class="flex-1"
        :icon="ICONS.kills"
        variant="outline"
        @click="emit('openKillModal', pairingId)"
      >
        {{ t('event.pairing.killsButton') }}
      </UButton>
    </UTooltip>

    <!-- Draw ("Patta") — sits outside both the ranking and kills modals since
         it sets both at once (zero kills, everyone tied for first). -->
    <UTooltip :content="{ side: 'top' }" :text="t('event.killModal.drawHint')">
      <UButton
        color="neutral"
        class="flex-1"
        :icon="ICONS.draw"
        variant="outline"
        @click="emit('draw', pairingId)"
      >
        {{ t('event.pairing.drawButton') }}
      </UButton>
    </UTooltip>
  </div>
</template>
