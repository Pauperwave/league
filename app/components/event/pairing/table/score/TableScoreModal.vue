<!-- app\components\event\pairing\table\score\TableScoreModal.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { getPairingPlayerIds, type Pairing } from '#shared/utils/types'

const { t } = useI18n()

const props = defineProps<{
  pairing: Pairing | null
  tableIndex: number | null
  getPlayerName: (playerId: number) => string
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  submit: [scores: { team1: number; team2: number }]
}>()

const team1Score = ref(0)
const team2Score = ref(0)

function handleSubmit() {
  emit('submit', { team1: team1Score.value, team2: team2Score.value })
  open.value = false
}

function handleCancel() {
  open.value = false
}

function getPairingPlayers(pairing: Pairing | null): number[] {
  if (!pairing) return []
  return getPairingPlayerIds(pairing)
}

const team1Players = computed(() => {
  const players = getPairingPlayers(props.pairing)
  if (players.length >= 2) {
    return [players[0], players[1]]
  }
  return players
})

const team2Players = computed(() => {
  const players = getPairingPlayers(props.pairing)
  if (players.length >= 4) {
    return [players[2], players[3]]
  }
  return []
})
</script>

<template>
  <UModal v-model:open="open">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon :name="ICONS.standings" class="size-5 text-primary" />
          <h3 class="text-lg font-semibold">{{ t('event.tableScoreModal.headingTemplate', { n: tableIndex !== null ? tableIndex + 1 : '' }) }}</h3>
        </div>
      </template>

      <div class="space-y-6">
        <TableScoreTeamRow
          v-model="team1Score"
          :label="t('event.tableScoreModal.team1')"
          :players="team1Players.filter((id): id is number => id !== undefined)"
          :get-player-name="getPlayerName"
        />
        <TableScoreTeamRow
          v-model="team2Score"
          :label="t('event.tableScoreModal.team2')"
          :players="team2Players.filter((id): id is number => id !== undefined)"
          :get-player-name="getPlayerName"
        />
      </div>

      <template #footer>
        <ModalFooterActions
          :confirm-label="t('common.confirm')"
          @cancel="handleCancel"
          @confirm="handleSubmit"
        />
      </template>
    </UCard>
  </UModal>
</template>
