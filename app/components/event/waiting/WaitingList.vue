<!-- app\components\event\waiting\WaitingList.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'
import type { WaitingListFlags } from '~/composables/event/useWaitingListFlags'

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

function handleUpdate(payload: { playerId: number, paid: boolean }) {
  flags.value = {
    ...flags.value,
    [payload.playerId]: { paid: payload.paid },
  }
  emit('update', payload)
}

function forgetFlags(playerIds: number[]) {
  const toForget = new Set(playerIds)
  flags.value = Object.fromEntries(
    Object.entries(flags.value).filter(([id]) => !toForget.has(Number(id)))
  ) as Record<number, WaitingListFlags>
}

const emit = defineEmits<{
  update: [{ playerId: number, paid: boolean }]
  edit: [playerId: number]
  remove: [playerId: number]
  batchRemove: [playerIds: number[]]
  batchMarkPaid: [playerIds: number[]]
  select: [playerIds: number[]]
  createNew: []
}>()

// — Add players (inline search + create) —

const selectedPlayerIds = ref<string[]>([])
const hasSelection = computed(() => selectedPlayerIds.value.length > 0)

const availablePlayers = computed(() =>
  props.players.filter(p => !props.waitingPlayers.includes(p.player_id))
)
const addPlayersItems = usePlayerOptions(availablePlayers)
const allPlayersInQueue = computed(() =>
  props.players.length > 0 && props.players.every(p => props.waitingPlayers.includes(p.player_id))
)

const addPlayersLogging = useButtonLogging('Add Players')
function handleAddSelected() {
  addPlayersLogging.logClick()
  emit('select', selectedPlayerIds.value.map(Number))
  selectedPlayerIds.value = []
}

const createNewLogging = useButtonLogging('Create New Player')
function handleCreateNew() {
  createNewLogging.logClick()
  emit('createNew')
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
    }
  })
})

</script>

<template>
  <div class="bg-muted/30 rounded-lg p-4 space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="font-semibold text-xl flex items-center gap-2">
        <UIcon :name="ICONS.players" size="lg" class="text-muted" />
        {{ t('event.waitingList.heading') }}
      </h2>
      <WaitingListStats
        :player-count="waitingPlayers.length"
        :table-estimate="tableEstimate"
      />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <USelectMenu
        v-model="selectedPlayerIds"
        :items="addPlayersItems"
        value-key="value"
        multiple
        :icon="ICONS.addPlayer"
        :placeholder="t('player.searchModal.addPlayersPlaceholder')"
        :search-input="{ placeholder: t('player.searchModal.searchInputPlaceholder') }"
        class="w-full sm:w-120"
      />
      <UButton
        color="primary"
        :icon="ICONS.playerConfirmed"
        :label="t('player.searchModal.addCount', { count: selectedPlayerIds.length })"
        :disabled="!hasSelection"
        @click="handleAddSelected"
      />
      <UButton
        color="neutral"
        variant="ghost"
        :icon="ICONS.addPlayer"
        :label="t('player.searchModal.createNew')"
        @click="handleCreateNew"
      />
      <span v-if="players.length === 0" class="text-sm text-muted">
        {{ t('player.searchModal.noPlayersRegistered') }}
      </span>
      <span v-else-if="allPlayersInQueue" class="text-sm text-muted">
        {{ t('player.searchModal.allInQueue') }}
      </span>
    </div>

    <WaitingListTable
      :data="tableData"
      @update="handleUpdate"
      @edit="emit('edit', $event)"
      @remove="(playerId: number) => { forgetFlags([playerId]); emit('remove', playerId) }"
      @batch-remove="(playerIds: number[]) => { forgetFlags(playerIds); emit('batchRemove', playerIds) }"
      @batch-mark-paid="emit('batchMarkPaid', $event)"
    />
  </div>
</template>
