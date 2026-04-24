<!-- app\components\Events\WaitingList.vue -->
<script setup lang="ts">
import { useButtonLogging } from '~/composables/useButtonLogging'

const props = defineProps<{
  waitingPlayers: number[]
  playerNames: Record<number, string>
  waitroomEntries?: Map<number, string>
  tableEstimate?: string
}>()

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
  return props.waitingPlayers.map((playerId, index) => ({
    index: index + 1,
    playerId,
    name: props.playerNames[playerId] ?? `Player ${playerId}`,
    time: formatTime(props.waitroomEntries?.get(playerId)),
    paid: false, // Valore iniziale, gestito dalla tabella
    companion: false, // Valore iniziale, gestito dalla tabella
  }))
})

</script>

<template>
  <div class="bg-muted/30 rounded-lg p-4 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2 class="font-semibold text-xl flex items-center gap-2">
          <UIcon name="i-lucide-users" size="lg" class="text-muted" />
          Lista d'Attesa
        </h2>
      </div>

      <div class="flex items-center gap-3">
        <WaitingListStats
          :player-count="waitingPlayers.length"
          :table-estimate="tableEstimate"
        />
        <UButton
          color="warning"
          variant="subtle"
          size="lg"
          icon="i-lucide-user-plus"
          label="Aggiungi Giocatori"
          class="font-semibold"
          @click="handleAddPlayer"
        />
      </div>
    </div>

    <WaitingListTable
      :data="tableData"
      @update="emit('update', $event)"
      @edit="emit('edit', $event)"
      @remove="emit('remove', $event)"
      @batch-remove="emit('batchRemove', $event)"
      @batch-mark-paid="emit('batchMarkPaid', $event)"
      @batch-mark-companion="emit('batchMarkCompanion', $event)"
    />
  </div>
</template>
