<script setup lang="ts">
interface Props {
  waitingPlayers: number[]
  playerNames: Record<number, string>
  waitroomEntries?: Map<number, string>
  tableEstimate?: string
}

defineProps<Props>()

const emit = defineEmits<{
  remove: [playerId: number]
  addPlayer: []
}>()

const paidPlayers = ref<Set<number>>(new Set())

function togglePaid(playerId: number) {
  if (paidPlayers.value.has(playerId)) {
    paidPlayers.value.delete(playerId)
  } else {
    paidPlayers.value.add(playerId)
  }
}

function formatTime(isoString: string | undefined): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="bg-muted/30 rounded-lg p-4 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 class="font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-users" class="size-4 text-muted" />
          Lista d'Attesa
        </h3>
        <UBadge v-if="waitingPlayers.length > 0" variant="subtle" size="sm">
          {{ waitingPlayers.length }} giocatori
        </UBadge>
      </div>
      <div class="flex items-center gap-2">
        <UBadge v-if="tableEstimate" color="primary" variant="subtle" size="sm">
          {{ tableEstimate }}
        </UBadge>
        <UButton
          color="primary"
          variant="soft"
          size="sm"
          icon="i-lucide-user-plus"
          @click="emit('addPlayer')"
        >
          Aggiungi
        </UButton>
      </div>
    </div>

    <div v-if="waitingPlayers.length > 0" class="space-y-1">
      <div
        v-for="(playerId, index) in waitingPlayers"
        :key="playerId"
        class="flex items-center justify-between p-2 bg-elevated rounded"
      >
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted font-mono w-8 text-right">#{{ index + 1 }}</span>
          <span class="text-base font-medium">{{ playerNames[playerId] || `Player ${playerId}` }}</span>
          <span class="text-sm text-muted">{{ formatTime(waitroomEntries?.get(playerId)) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <UCheckbox
            :model-value="paidPlayers.has(playerId)"
            size="sm"
            aria-label="Pagato"
            @update:model-value="togglePaid(playerId)"
          />
          <UBadge size="xs" variant="subtle" color="neutral">ID {{ playerId }}</UBadge>
          <UButton
            color="error"
            variant="ghost"
            size="xs"
            icon="i-lucide-x"
            aria-label="Rimuovi"
            @click="emit('remove', playerId)"
          />
        </div>
      </div>
    </div>
    <p v-else class="text-muted text-center py-4">
      Nessun giocatore in lista d'attesa
    </p>
  </div>
</template>
