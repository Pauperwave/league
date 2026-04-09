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

// Run data fetching in parallel instead of sequentially
await Promise.all([
  useAsyncData(`waiting-${eventId}`, refreshWaiting),
  useAsyncData(`event-standings-${eventId}`, refreshStandings),
])

const showEventEditModal = ref(false)
const showNextRoundModal = ref(false)
const showPlayerSearchModal = ref(false)

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
  return new Date(dt).toLocaleDateString('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

// Cleaner with Object.fromEntries
const playerNames = computed<Record<number, string>>(() =>
  Object.fromEntries(
    players.value.map(p => [p.player_id, `${p.player_name} ${p.player_surname}`])
  )
)

// Extracted from template to keep it readable
const breadcrumbItems = computed(() => [
  { label: 'Home', to: '/', icon: 'i-lucide-home' },
  { label: 'Leghe', to: '/leagues' },
  { label: currentLeague.value?.name ?? 'Lega', to: `/league/${leagueId}` },
  { label: currentEvent.value?.event_name ?? 'Evento' },
])
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="p-6 pb-0">
      <UBreadcrumb :items="breadcrumbItems" />
    </div>

    <div class="flex flex-col gap-6 p-6 items-start">
      <div class="flex flex-col lg:flex-row gap-6 w-full">

        <!-- Header Card -->
        <EventHeaderCard
          :event-name="currentEvent?.event_name ?? 'Evento'"
          :event-date="formattedDate"
          :is-playing="isPlaying"
          :is-event-ended="isEventEnded"
          :is-registration-open="isRegistrationOpen"
          @edit="showEventEditModal = true"
        >
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
          <div v-else-if="isPlaying && !isEventEnded" class="flex flex-col gap-3">
            <RoundTimer
              v-if="currentEvent?.event_round_duration"
              :duration-minutes="currentEvent.event_round_duration"
              :round="currentRound"
              @expired="useToast().add({ title: 'Tempo scaduto!', color: 'warning', icon: 'i-lucide-alarm-clock' })"
            />
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-arrow-right"
              loading-auto
              @click="showNextRoundModal = true"
            >
              Prossimo Round
            </UButton>
          </div>

          <!-- Ended -->
          <EndedEventBadge v-else-if="isEventEnded" />
        </EventHeaderCard>

        <!-- Pairings / Tables -->
        <PairingsCard
          v-if="isPlaying || isEventEnded"
          :pairings="pairings"
          :current-round="currentRound"
          :get-player-name="getPlayerName"
          :has-submitted-score="hasSubmittedScore"
          :on-navigate-to-score="navigateToScore"
        />

        <!-- Empty State -->
        <EmptyStateCard v-if="!isPlaying && !isEventEnded" class="lg:w-1/3" />
      </div>
    </div>

    <!-- Modals -->
    <NextRoundModal
      v-model:open="showNextRoundModal"
      @confirm="confirmNextRound"
    />

    <EventFormModal
      v-model:open="showEventEditModal"
      :event="currentEvent ?? null"
      :league-id="leagueId"
      @update="handleUpdateEvent"
    />
  </div>
</template>
