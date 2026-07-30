<!-- app\components\tournament\round-status\RoundStatusRow.vue -->
<script setup lang="ts">
/**
 * Generic clickable row shared by all 4 RoundStatusCard sections — renders
 * either a table label (rankings/kills) or a player tag (commanders/votes)
 * depending on which props are passed, same visual language as
 * WinnerChecklist.vue's rows.
 */
interface Props {
  done: boolean
  tableNumber?: number
  playerId?: number
  playerName?: string
  playerSurname?: string
  playerAvatarUrl?: string
}

const {
  done,
  tableNumber,
  playerId,
  playerName = '',
  playerSurname = '',
  playerAvatarUrl,
} = defineProps<Props>()

const emit = defineEmits<{
  select: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="flex items-center justify-between gap-2 p-1.5 rounded-lg cursor-pointer"
    :class="done ? 'bg-success/10' : 'bg-muted/30'"
    @click="emit('select')"
  >
    <div class="flex items-center gap-1.5 min-w-0">
      <div v-if="tableNumber !== undefined" class="flex items-center gap-1 shrink-0">
        <UIcon :name="ICONS.tableView" class="size-3.5 text-primary" />
        <span class="text-sm font-semibold">{{ t('tournament.pairing.tableHeading', { n: tableNumber }) }}</span>
      </div>
      <PlayerNameTag
        v-else
        :name="playerName"
        :surname="playerSurname"
        :player-id="playerId"
        :avatar-url="playerAvatarUrl"
        :linkable="false"
        avatar-size="xs"
      />
    </div>

    <UIcon
      :name="done ? ICONS.confirm : ICONS.clock"
      class="size-4 shrink-0"
      :class="done ? 'text-success' : 'text-muted'"
    />
  </div>
</template>
