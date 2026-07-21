<!-- app\components\event\waiting\WaitingList.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'

const { t } = useI18n()

const props = defineProps<{
  waitingPlayers: number[]
  players: Player[]
  eventId: number
  waitroomEntries?: Map<number, string>
  tableEstimate?: string
}>()

const playersById = computed(() => new Map(props.players.map(p => [p.player_id, p])))

const { flags } = useWaitingListFlags(props.eventId)

function handleUpdate(payload: { playerId: number, paid: boolean, companion: boolean }) {
  flags.value = {
    ...flags.value,
    [payload.playerId]: { paid: payload.paid, companion: payload.companion },
  }
  emit('update', payload)
}

function forgetFlags(playerIds: number[]) {
  const next = { ...flags.value }
  for (const id of playerIds) delete next[id]
  flags.value = next
}

const emit = defineEmits<{
  update: [{ playerId: number, paid: boolean, companion: boolean }]
  edit: [playerId: number]
  remove: [playerId: number]
  batchRemove: [playerIds: number[]]
  batchMarkPaid: [playerIds: number[]]
  batchMarkCompanion: [playerIds: number[]]
  addPlayer: []
}>()

const addPlayerLogging = useButtonLogging('Add Player')

function handleAddPlayer() {
  addPlayerLogging.logClick()
  emit('addPlayer')
}

// — Table data —
function formatTime(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

const tableData = computed(() => {
  return props.waitingPlayers.map((playerId, index) => {
    const player = playersById.value.get(playerId)
    return {
      index: index + 1,
      playerId,
      name: player?.player_name ?? t('league.ranking.playerFallback', { id: playerId }),
      surname: player?.player_surname ?? '',
      time: formatTime(props.waitroomEntries?.get(playerId)),
      paid: flags.value[playerId]?.paid ?? false,
      companion: flags.value[playerId]?.companion ?? false,
    }
  })
})

</script>

<template>
  <div class="bg-muted/30 rounded-lg p-4 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <h2 class="font-semibold text-xl flex items-center gap-2">
          <UIcon :name="ICONS.players" size="lg" class="text-muted" />
          {{ t('event.waitingList.heading') }}
        </h2>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <WaitingListStats
          :player-count="waitingPlayers.length"
          :table-estimate="tableEstimate"
        />
        <UButton
          color="warning"
          variant="subtle"
          size="lg"
          :icon="ICONS.addPlayer"
          :label="t('event.waitingList.addPlayers')"
          class="font-semibold"
          @click="handleAddPlayer"
        />
      </div>
    </div>

    <WaitingListTable
      :data="tableData"
      @update="handleUpdate"
      @edit="emit('edit', $event)"
      @remove="(playerId: number) => { forgetFlags([playerId]); emit('remove', playerId) }"
      @batch-remove="(playerIds: number[]) => { forgetFlags(playerIds); emit('batchRemove', playerIds) }"
      @batch-mark-paid="emit('batchMarkPaid', $event)"
      @batch-mark-companion="emit('batchMarkCompanion', $event)"
    />
  </div>
</template>
