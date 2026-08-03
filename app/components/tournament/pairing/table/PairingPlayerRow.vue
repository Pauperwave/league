<!-- app\components\tournament\pairing\table\PairingPlayerRow.vue -->
<script setup lang="ts">

const { t } = useI18n()

defineProps<{
  playerId: number
  pairingId: number
  name: string
  surname: string
  readonly?: boolean
  hasCommander: boolean
  hasVotes: boolean
}>()

const emit = defineEmits<{
  openCommanderModal: [pairingId: number, playerId: number]
  openVotesModal: [pairingId: number, playerId: number]
}>()
</script>

<template>
  <div class="flex items-center gap-2 p-1.5 bg-elevated rounded">
    <PlayerNameTag
      :name="name"
      :surname="surname"
      :player-id="playerId"
      class="flex-1"
    />

    <template v-if="!readonly">
      <!-- Commander button -->
      <UTooltip
        :key="`cmd-${playerId}-${hasCommander ? 1 : 0}`"
        :content="{ side: 'right' }"
        :text="hasCommander
          ? t('tournament.pairing.commanderSetTooltip')
          : t('tournament.pairing.commanderNotSetTooltip')"
      >
        <UButton
          size="sm"
          variant="outline"
          :color="hasCommander ? 'success' : 'neutral'"
          :icon="hasCommander ? ICONS.commanderSet : ICONS.commanderNotSet"
          :aria-label="t('tournament.pairing.commanderAriaLabel')"
          @click="emit('openCommanderModal', pairingId, playerId)"
        />
      </UTooltip>

      <!-- Vote button -->
      <UTooltip
        :key="`vote-${playerId}-${hasVotes ? 1 : 0}`"
        :content="{ side: 'right' }"
        :text="hasVotes
          ? t('tournament.pairing.voteSetTooltip')
          : t('tournament.pairing.voteNotSetTooltip')"
      >
        <UButton
          size="sm"
          variant="outline"
          :color="hasVotes ? 'success' : 'neutral'"
          :icon="hasVotes ? ICONS.confirm : ICONS.vote"
          :aria-label="t('tournament.pairing.voteAriaLabel')"
          @click="emit('openVotesModal', pairingId, playerId)"
        />
      </UTooltip>
    </template>
  </div>
</template>
