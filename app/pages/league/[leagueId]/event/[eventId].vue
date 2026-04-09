<!-- league\app\pages\league\[leagueId]\event\[eventId].vue -->
<script setup lang="ts">
const {
  leagueId,
  eventId,
  currentLeague,
  currentEvent,
  currentRound,
  isEventEnded,
  isPlaying,
  isRegistrationOpen,
  canStartEvent,
  waitingPlayers,
  waitroomEntries,
  pairings,
  players,
  tableEstimate,
  getPlayerName,
  hasSubmittedScore,
  addToWaitingList,
  removeFromWaitingList,
  startEvent,
  nextRound,
  updateEvent,
  navigateToScore,
  refreshWaiting,
  refreshStandings,
} = useEventPage()

await useAsyncData(`waiting-${eventId}`, refreshWaiting)
await useAsyncData(`event-standings-${eventId}`, refreshStandings)

const showEventEditModal = ref(false)
const showNextRoundModal = ref(false)
const showPlayerSearchModal = ref(false)

const eventBadgeColor = computed(() => {
  if (isEventEnded.value) return 'neutral'
  return isPlaying.value ? 'success' : 'warning'
})

async function confirmNextRound() {
  await nextRound()
  showNextRoundModal.value = false
}

async function handleUpdateEvent(payload: Parameters<typeof updateEvent>[0]) {
  const ok = await updateEvent(payload)
  if (ok) showEventEditModal.value = false
}

const formattedDate = computed(() => {
  const dt = currentEvent.value?.event_datetime
  if (!dt) return ''
  return new Date(dt).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })
})

const pairingPlayerIds = (pairing: typeof pairings.value[number]) =>
  ([pairing.pairing_player1_id, pairing.pairing_player2_id, pairing.pairing_player3_id, pairing.pairing_player4_id])
    .filter((id): id is number => !!id)

const playerNames = computed(() => {
  const names: Record<number, string> = {}
  players.value.forEach(p => {
    names[p.player_id] = `${p.player_name} ${p.player_surname}`
  })
  return names
})
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="p-6 pb-0">
      <UBreadcrumb
        :items="[
          { label: 'Home', to: '/', icon: 'i-lucide-home' },
          { label: 'Leghe', to: '/leagues' },
          { label: currentLeague?.name || 'Lega', to: `/league/${leagueId}` },
          { label: currentEvent?.event_name || 'Evento' },
        ]"
      />
    </div>

    <div class="flex flex-col gap-6 p-6 items-start">
      <!-- Header Card -->
      <UCard variant="outline">
        <template #header>
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-calendar" class="size-5 text-primary mt-1" />
              <div>
                <div class="flex items-center gap-2">
                  <h1 class="text-xl font-semibold">
                    {{ currentEvent?.event_name || 'Evento' }}
                  </h1>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-pencil"
                    size="xs"
                    aria-label="Modifica evento"
                    @click="showEventEditModal = true"
                  />
                </div>
                <p class="text-sm text-muted">{{ formattedDate }}</p>
              </div>
            </div>
            <div class="flex flex-col items-end gap-1">
              <div class="flex items-center gap-2">
                <UBadge :color="eventBadgeColor">
                  {{ isPlaying ? 'In Corso' : isEventEnded ? 'Terminato' : 'Programmato' }}
                </UBadge>
              </div>
              <UBadge :color="isRegistrationOpen ? 'success' : 'error'">
                {{ isRegistrationOpen ? 'Iscrizioni Aperte' : 'Iscrizioni Chiuse' }}
              </UBadge>
            </div>
          </div>
        </template>

        <!-- Registration Phase -->
        <div v-if="!isPlaying && isRegistrationOpen" class="space-y-4">
          <StartEventButton
            :disabled="!canStartEvent"
            @click="startEvent"
          />

          <WaitingList
            :waiting-players="waitingPlayers"
            :player-names="playerNames"
            :waitroom-entries="waitroomEntries"
            :table-estimate="tableEstimate"
            @remove="removeFromWaitingList"
            @add-player="showPlayerSearchModal = true"
          />

          <PlayerSearchModal
            v-model:open="showPlayerSearchModal"
            :players="players"
            :waiting-players="waitingPlayers"
            @select="addToWaitingList"
          />
        </div>

        <!-- Playing Phase -->
        <div v-else-if="isPlaying && !isEventEnded" class="flex gap-2">
          <UModal v-model:open="showNextRoundModal" title="Prossimo Round" description="Procedere al prossimo round?">
            <UButton color="primary" variant="soft" icon="i-lucide-arrow-right" @click="showNextRoundModal = true">
              Prossimo Round
            </UButton>

            <template #footer>
              <div class="flex justify-end gap-2">
                <UButton color="neutral" variant="ghost" @click="showNextRoundModal = false">
                  Annulla
                </UButton>
                <UButton color="primary" @click="confirmNextRound">
                  Conferma
                </UButton>
              </div>
            </template>
          </UModal>
        </div>

        <!-- Ended -->
        <div v-else-if="isEventEnded" class="text-center py-4">
          <UBadge color="neutral" size="lg" icon="i-lucide-check-circle">
            Evento Terminato
          </UBadge>
        </div>
      </UCard>

      <!-- Pairings / Tables -->
      <UCard v-if="isPlaying || isEventEnded" variant="outline">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-layout-grid" class="size-5 text-primary" />
            <h2 class="text-lg font-semibold">Tavoli</h2>
          </div>
        </template>

        <div v-if="pairings.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="(pairing, index) in pairings"
            :key="pairing.pairing_id"
            class="bg-muted/30 rounded-lg p-4"
          >
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold flex items-center gap-2">
                <UIcon name="i-lucide-table-2" class="size-4 text-muted" />
                Tavolo {{ index + 1 }}
              </h3>
              <UBadge size="sm" variant="subtle">Round {{ currentRound }}</UBadge>
            </div>

            <div class="space-y-2">
              <div
                v-for="playerId in pairingPlayerIds(pairing)"
                :key="playerId"
                class="flex items-center justify-between p-2 bg-elevated rounded"
              >
                <div class="flex items-center gap-2">
                  <UIcon
                    :name="hasSubmittedScore(pairing.pairing_id, playerId) ? 'i-lucide-check-circle' : 'i-lucide-circle'"
                    :class="hasSubmittedScore(pairing.pairing_id, playerId) ? 'text-success' : 'text-muted'"
                  />
                  <span>{{ getPlayerName(playerId) }}</span>
                </div>
                <UButton
                  :color="hasSubmittedScore(pairing.pairing_id, playerId) ? 'success' : 'primary'"
                  size="xs"
                  @click="navigateToScore(pairing.pairing_id, playerId, index)"
                >
                  {{ hasSubmittedScore(pairing.pairing_id, playerId) ? 'Modifica' : 'Inserisci' }}
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8 text-muted">
          <UIcon name="i-lucide-users" class="text-4xl mb-2" />
          <p>Nessun tavolo disponibile</p>
        </div>
      </UCard>

      <!-- Empty State -->
      <UCard v-else variant="outline">
        <div class="text-center py-12 text-muted">
          <UIcon name="i-lucide-calendar-x" class="text-5xl mb-4" />
          <p class="text-lg">L'evento non è ancora iniziato</p>
          <p class="text-sm">Aggiungi giocatori alla lista d'attesa e avvia l'evento</p>
        </div>
      </UCard>
    </div>

    <!-- Edit Event Modal -->
    <EventFormModal
      v-model:open="showEventEditModal"
      :event="currentEvent ?? null"
      :league-id="leagueId"
      @update="handleUpdateEvent"
    />
  </div>
</template>
