<!-- app\components\event\pairing\table\PairingTableActions.vue -->
<script setup lang="ts">

const { t } = useI18n()

defineProps<{
  pairingId: number
  tableIndex: number
  hasRanking: boolean
  killsConfirmed: boolean
}>()

const emit = defineEmits<{
  openScoreModal: [pairingId: number, tableIndex: number]
  openKillModal: [pairingId: number]
  toggleKillConfirmation: [pairingId: number]
}>()
</script>

<template>
  <div class="flex gap-2 mt-3">
    <!-- Rankings button -->
    <UTooltip :content="{ side: 'top' }" :text="hasRanking ? t('event.pairing.rankingSetTooltip') : t('event.pairing.rankingNotSetTooltip')">
      <UButton
        :color="hasRanking ? 'neutral' : 'warning'"
        class="flex-1"
        :icon="ICONS.standings"
        variant="outline"
        @click="emit('openScoreModal', pairingId, tableIndex)"
      >
        {{ t('event.pairing.rankingButton') }}
      </UButton>
    </UTooltip>

    <!-- Kills entry button -->
    <UTooltip :content="{ side: 'top' }" :text="killsConfirmed ? t('event.pairing.killsSetTooltip') : t('event.pairing.killsNotSetTooltip')">
      <UButton
        :color="killsConfirmed ? 'neutral' : 'warning'"
        class="flex-1"
        :icon="ICONS.kills"
        variant="outline"
        @click="emit('openKillModal', pairingId)"
      >
        {{ t('event.pairing.killsButton') }}
      </UButton>
    </UTooltip>

    <!-- Kill confirmation toggle -->
    <UTooltip
      :content="{ side: 'top' }"
      :text="killsConfirmed ? t('event.pairing.removeKillConfirmTooltip') : t('event.pairing.confirmKillsTooltip')"
    >
      <UButton
        :color="killsConfirmed ? 'success' : 'warning'"
        :icon="killsConfirmed ? ICONS.confirm : ICONS.dot"
        variant="outline"
        size="sm"
        :aria-label="killsConfirmed ? t('event.pairing.removeKillConfirmTooltip') : t('event.pairing.confirmKillsAriaLabel')"
        @click="emit('toggleKillConfirmation', pairingId)"
      />
    </UTooltip>
  </div>
</template>
