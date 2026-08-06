<!-- app\components\tournament\waiting\WaitingList.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'
import type { WaitingListFlags, PaymentMethod } from '~/composables/tournament/useWaitingListFlags'
import type { LastEndedTournamentParticipants } from '~/composables/tournament/useTournamentQueries'

const { t } = useI18n()

const props = defineProps<{
  waitingPlayers: number[]
  players: Player[]
  tournamentId: number
  waitroomEntries?: Map<number, string>
  tableEstimate?: string
  lastTournamentParticipants?: LastEndedTournamentParticipants | null
}>()

const playersById = computed(() => new Map(props.players.map(p => [p.player_id, p])))

const { flags } = useWaitingListFlags(props.tournamentId)

function handleUpdate(payload: { playerId: number, paymentMethod: PaymentMethod | null }) {
  flags.value = {
    ...flags.value,
    [payload.playerId]: { paymentMethod: payload.paymentMethod },
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
  update: [{ playerId: number, paymentMethod: PaymentMethod | null }]
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

// "Aggiungi dall'ultima tappa" — participants of the league's last ended
// tournament. Stays populated even once a player is already in this
// tournament's waiting list — LastTournamentParticipantsTable swaps that
// row's button state instead of the row disappearing.
const lastTournamentPlayers = computed(() => {
  const participants = props.lastTournamentParticipants
  if (!participants) return []

  return participants.playerIds
    .map(id => playersById.value.get(id))
    .filter((player): player is Player => player !== undefined)
    .sort((a, b) => a.player_surname.localeCompare(b.player_surname, 'it'))
})

const addFromLastTournamentLogging = useButtonLogging(
  t('logging.waitingList.addFromLastTournament')
)
function handleAddFromLastTournament(playerId: number) {
  addFromLastTournamentLogging.logClick()
  emit('select', [playerId])
}
const allPlayersInQueue = computed(() =>
  props.players.length > 0 && props.players.every(p => props.waitingPlayers.includes(p.player_id))
)

const addPlayersLogging = useButtonLogging(t('logging.waitingList.addPlayers'), {
  playerNames: () => selectedPlayerIds.value.map((id) => {
    const player = playersById.value.get(Number(id))
    return player ? `${player.player_name} ${player.player_surname}` : `#${id}`
  }),
})
function handleAddSelected() {
  addPlayersLogging.logClick()
  emit('select', selectedPlayerIds.value.map(Number))
  selectedPlayerIds.value = []
}

const createNewLogging = useButtonLogging(t('logging.waitingList.createNewPlayer'))
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
      paymentMethod: flags.value[playerId]?.paymentMethod ?? null,
    }
  })
})

</script>

<template>
  <div
    class="grid gap-4"
    :class="lastTournamentPlayers.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' : ''"
  >
    <LastTournamentParticipantsTable
      v-if="lastTournamentPlayers.length > 0 && lastTournamentParticipants"
      :tournament-name="lastTournamentParticipants.tournamentName"
      :players="lastTournamentPlayers"
      :waiting-players="waitingPlayers"
      @add="handleAddFromLastTournament"
    />

    <div class="bg-muted/30 rounded-lg p-4 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="font-semibold text-xl flex items-center gap-2">
          <UIcon :name="ICONS.players" size="lg" class="text-muted" />
          {{ t('tournament.waitingList.heading') }}
        </h2>
        <WaitingListStats
          :player-count="waitingPlayers.length"
          :table-estimate="tableEstimate"
        />
      </div>

      <WaitingListTable
        :data="tableData"
        @update="handleUpdate"
        @edit="emit('edit', $event)"
        @remove="(playerId: number) => {
          forgetFlags([playerId])
          emit('remove', playerId)
        }"
        @batch-remove="(playerIds: number[]) => {
          forgetFlags(playerIds)
          emit('batchRemove', playerIds)
        }"
        @batch-mark-paid="emit('batchMarkPaid', $event)"
      >
        <template #search-actions>
          <USelectMenu
            v-model="selectedPlayerIds"
            :items="addPlayersItems"
            value-key="value"
            multiple
            :icon="ICONS.addPlayer"
            :placeholder="t('player.searchModal.addPlayersPlaceholder')"
            :search-input="{ placeholder: t('player.searchModal.searchInputPlaceholder') }"
            class="w-full sm:w-80"
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
            variant="soft"
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
        </template>
      </WaitingListTable>
    </div>
  </div>
</template>
