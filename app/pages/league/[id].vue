<!-- app\pages\league\[leagueId].vue -->
<script setup lang="ts">
import type { Event } from '#shared/utils/types'

interface CreateEventData {
  eventName: string
  eventDate: string
  numRound: number
  roundDuration: number
}

interface UpdateEventData {
  id: number
  data: { eventName: string; eventDate: string | null; numRound: number; roundDuration: number }
}

interface UpdateLeagueData {
  id: number
  data: { name: string; startsAt: string | null; endsAt: string | null; rulesetId: number | null }
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const leagueId = Number(route.params.id)

const leagueStore = useLeagueStore()
const eventsStore = useEventStore()

const { standings } = storeToRefs(eventsStore)

const { data: rulesetsData, pending: rulesetsLoading } = useRulesets()
const rulesets = computed(() => rulesetsData.value ?? [])

const { data: events, pending: eventsLoading, refresh: refreshEvents } = useEvents(leagueId)

const currentLeague = computed(() => leagueStore.getLeagueById(leagueId))

// Fetch league data if not already in store (e.g., on direct page reload)
if (!currentLeague.value) {
  await leagueStore.fetchLeagues()
}
const classificaTitle = computed(() =>
  `Classifica ${currentLeague.value?.name ?? ''}`.trim()
)

const breadcrumbItems = computed(() => [
  { label: 'Home', to: '/', icon: 'i-lucide-home' },
  { label: 'Leghe', to: '/leagues' },
  { label: currentLeague.value?.name ?? 'Lega' },
])

const { error: standingsError } = await useAsyncData(`league-standings-${leagueId}`, () => eventsStore.fetchLeagueStandings(leagueId))

onMounted(() => {
  if (standingsError.value) {
    toast.add({
      title: 'Errore caricamento classifica',
      description: standingsError.value.message || 'Impossibile caricare la classifica della lega',
      color: 'error'
    })
  }
})

// — Modal state —
const showCreateModal = ref(false)
const showLeagueEditModal = ref(false)

const showEventEditModal = ref(false)
const eventToEdit = ref<Event | null>(null)

const showDeleteConfirm = ref(false)
const eventToDelete = ref<Event | null>(null)

// — Navigation —
function navigateToEvent(event: Event) {
  console.log('[NAVIGATE TO EVENT] Navigating to event', {
    eventId: event.event_id,
    eventName: event.event_name,
    eventPlaying: event.event_playing,
    eventRegistrationOpen: event.event_registration_open,
    eventCurrentRound: event.event_current_round,
    targetUrl: `/league/${leagueId}/event/${event.event_id}`,
  })
  router.push(`/league/${leagueId}/event/${event.event_id}`)
}

// — Event CRUD —
async function createEvent(data: CreateEventData) {
  const result = await eventsStore.createEvent({
    event_name: data.eventName,
    league_id: leagueId,
    event_datetime: data.eventDate,
    event_round_number: data.numRound,
    event_round_duration: data.roundDuration,
    event_registration_open: true,
  })

  if (!result.success) {
    toast.add({
      title: 'Errore creazione evento',
      description: result.error || 'Impossibile creare l\'evento',
      color: 'error'
    })
    return
  }

  showCreateModal.value = false
  toast.add({
    title: 'Evento creato',
    description: `L'evento "${data.eventName}" è stato creato con successo.`,
    color: 'success'
  })
  await refreshEvents()
}

async function updateEvent({ id, data }: UpdateEventData) {
  const result = await eventsStore.updateEvent(id, {
    event_name: data.eventName,
    event_datetime: data.eventDate ?? undefined,
    event_round_number: data.numRound,
    event_round_duration: data.roundDuration,
  })

  if (!result.success) {
    toast.add({
      title: 'Errore aggiornamento evento',
      description: result.error || 'Impossibile aggiornare l\'evento',
      color: 'error'
    })
    return
  }

  showEventEditModal.value = false
  eventToEdit.value = null
  toast.add({
    title: 'Evento aggiornato',
    description: `L'evento "${data.eventName}" è stato aggiornato con successo.`,
    color: 'success'
  })
  await refreshEvents()
}

function openEditEvent(event: Event) {
  eventToEdit.value = event
  showEventEditModal.value = true
}

function openDeleteEvent(event: Event) {
  eventToDelete.value = event
  showDeleteConfirm.value = true
}

async function confirmDeleteEvent() {
  if (!eventToDelete.value) return

  const result = await eventsStore.deleteEvent(eventToDelete.value.event_id)

  if (!result.success) {
    toast.add({
      title: 'Errore eliminazione evento',
      description: result.error || 'Impossibile eliminare l\'evento',
      color: 'error'
    })
    return
  }

  showDeleteConfirm.value = false
  eventToDelete.value = null
  toast.add({
    title: 'Evento eliminato',
    description: 'L\'evento è stato eliminato con successo.',
    color: 'success'
  })
  await refreshEvents()
}

// — League —
async function updateLeague({ id, data }: UpdateLeagueData) {
  const result = await leagueStore.updateLeague(id, {
    name: data.name,
    starts_at: data.startsAt,
    ends_at: data.endsAt,
    ruleset_id: data.rulesetId,
  })

  if (!result.success) {
    toast.add({
      title: 'Errore aggiornamento lega',
      description: result.error || 'Impossibile aggiornare la lega',
      color: 'error'
    })
    return
  }

  showLeagueEditModal.value = false
  toast.add({
    title: 'Lega aggiornata',
    description: 'Le informazioni della lega sono state aggiornate con successo.',
    color: 'success'
  })
}
</script>

<template>
  <div class="h-full overflow-hidden bg-default">
    <div class="p-6 pb-0">
      <UBreadcrumb :items="breadcrumbItems" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 items-start">

      <!-- Events List -->
      <div class="lg:col-span-2 flex flex-col overflow-hidden h-full">
        <LeagueEventsPanel
          :league-id="leagueId"
          :current-league="currentLeague"
          :events="events ?? []"
          :events-loading="eventsLoading"
          @edit-league="showLeagueEditModal = true"
          @create-event="showCreateModal = true"
          @view-event="navigateToEvent"
          @edit-event="openEditEvent"
          @delete-event="openDeleteEvent"
        />
      </div>

      <!-- League Standings -->
      <div class="lg:col-span-1 h-full">
        <LeagueStandingsCard
          :title="classificaTitle"
          :standings="standings" />
      </div>
    </div>

    <!-- Modals -->
    <EventFormModal
      v-model:open="showCreateModal"
      :event="null"
      :league-id="leagueId"
      @create="createEvent"
    />

    <EventFormModal
      v-model:open="showEventEditModal"
      :event="eventToEdit"
      :league-id="leagueId"
      @update="updateEvent"
    />

    <LeagueFormModal
      v-model:open="showLeagueEditModal"
      :league="currentLeague"
      :rulesets="rulesets"
      :rulesets-loading="rulesetsLoading"
      @update="updateLeague"
    />

    <ConfirmModal
      v-model:open="showDeleteConfirm"
      title="Conferma Eliminazione"
      description="Stai per eliminare un evento"
      question="Sei sicuro di voler eliminare questo evento?"
      :subject="eventToDelete?.event_name"
      warning="Questa azione non può essere annullata."
      confirm-label="Elimina"
      cancel-label="Annulla"
      confirm-icon="i-lucide-trash-2"
      @confirm="confirmDeleteEvent"
    />
  </div>
</template>
