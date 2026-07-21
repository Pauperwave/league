<!-- app\components\deck\DeckPlayerChip.vue -->
<script setup lang="ts">
interface Props {
  to: string
  playerName?: string
  playerSurname?: string
  playerId?: number
  isBorrowed?: boolean
  suffix?: string
}

const { to, playerName, playerSurname, playerId, isBorrowed = false, suffix = '' } = defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <UButton :to="to" variant="soft" color="primary" size="sm">
    <PlayerNameTag
      v-if="playerName && playerSurname"
      :name="playerName"
      :surname="playerSurname"
      :player-id="playerId"
      :linkable="false"
      avatar-size="xs"
    />
    <span v-else>{{ t('deck.unknownPlayer') }}</span>
    <span v-if="suffix" class="text-muted ml-1">{{ suffix }}</span>
    <span v-if="isBorrowed" class="ml-1 text-warning">{{ t('deck.borrowedBadge') }}</span>
  </UButton>
</template>
