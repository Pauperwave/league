<script setup lang="ts">
interface Props {
  waitingPlayers: number[]
  playerNames: Record<number, string>
  waitroomEntries?: Map<number, string>
  tableEstimate?: string
}

const { waitingPlayers, playerNames, waitroomEntries, tableEstimate } = defineProps<Props>()

const emit = defineEmits<{
  remove: [playerId: number]
  addPlayer: []
}>()

// — Debounced player count for the stats badge —
const debouncedCount = ref(waitingPlayers.length)
watchDebounced(
  () => waitingPlayers.length,
  count => { debouncedCount.value = count },
  { debounce: 500, immediate: true }
)

// — Toggle state using Set for O(1) lookup —
const paidPlayers = ref(new Set<number>())
const companionPlayers = ref(new Set<number>())

function toggle(set: Set<number>, id: number): Set<number> {
  const next = new Set(set)
  next.has(id) ? next.delete(id) : next.add(id)
  return next
}

function togglePaid(id: number) { paidPlayers.value = toggle(paidPlayers.value, id) }
function toggleCompanion(id: number) { companionPlayers.value = toggle(companionPlayers.value, id) }

// — Table data —
const searchQuery = ref('')

function formatTime(iso: string | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

const tableData = computed(() => {
  const rows = waitingPlayers.map((playerId, index) => ({
    index: index + 1,
    playerId,
    name: playerNames[playerId] ?? `Player ${playerId}`,
    time: formatTime(waitroomEntries?.get(playerId)),
    paid: paidPlayers.value.has(playerId),
    companion: companionPlayers.value.has(playerId),
  }))

  if (!searchQuery.value) return rows

  const query = searchQuery.value.toLowerCase()
  return rows.filter(row =>
    row.name.toLowerCase().includes(query) ||
    row.playerId.toString().includes(query)
  )
})

// — Stats badge —
const statsLabel = computed(() => {
  const parts: string[] = []
  if (debouncedCount.value > 0) parts.push(`${debouncedCount.value} giocatori`)
  if (tableEstimate) parts.push(tableEstimate)
  return parts.join(' · ')
})
</script>

<template>
  <div class="bg-muted/30 rounded-lg p-4 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-users" class="size-4 text-muted" />
          Lista d'Attesa
        </h3>
        <UBadge v-if="statsLabel" color="warning" variant="subtle">
          {{ statsLabel }}
        </UBadge>
      </div>

      <UButton
        color="primary"
        variant="soft"
        size="sm"
        icon="i-lucide-user-plus"
        label="Aggiungi Giocatori"
        @click="emit('addPlayer')"
      />
    </div>

    <WaitingListTable
      v-model:search-query="searchQuery"
      :data="tableData"
      @toggle-paid="togglePaid"
      @toggle-companion="toggleCompanion"
      @remove="emit('remove', $event)"
    />
  </div>
</template>
