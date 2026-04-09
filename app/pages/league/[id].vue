<!-- app\pages\league\[id].vue -->
<script setup lang="ts">
import type { Event } from '#shared/utils/types'

interface CreateEventData {
  eventName: string
  eventDate: string
  numRound: number
}

interface UpdateEventData {
  id: number
  data: { eventName: string; eventDate: string | null; numRound: number }
}

interface UpdateLeagueData {
  id: number
  data: { name: string; startsAt: string | null; endsAt: string | null; rulesetId: number | null }
}

const route = useRoute()
const router = useRouter()
const leagueId = Number(route.params.id)

const leagueStore = useLeagueStore()
const eventsStore = useEventStore()

const { data: rulesetsData, pending: rulesetsLoading } = useRulesets()
const rulesets = computed(() => rulesetsData.value ?? [])

const { data: events, pending: eventsLoading, refresh: refreshEvents } = useEvents(leagueId)

const currentLeague = computed(() => leagueStore.getLeagueById(leagueId))
const standings = computed(() => eventsStore.standings)
const classificaTitle = computed(() =>
  currentLeague.value?.name ? `Classifica ${currentLeague.value.name}` : 'Classifica'
)

const breadcrumbItems = computed(() => [
  { label: 'Home', to: '/', icon: 'i-lucide-home' },
  { label: 'Leghe', to: '/leagues' },
  { label: currentLeague.value?.name ?? 'Lega' },
])

await useAsyncData(`standings-${leagueId}`, () => eventsStore.fetchLeagueStandings(leagueId))

// — Modal state —
const showCreateModal = ref(false)
const showLeagueEditModal = ref(false)

const showEventEditModal = ref(false)
const eventToEdit = ref<Event | null>(null)

const showDeleteConfirm = ref(false)
const eventToDelete = ref<Event | null>(null)

// — Navigation —
function navigateToEvent(event: Event) {
  router.push(`/league/${leagueId}/event/${event.event_id}`)
}

// — Event CRUD —
async function createEvent(data: CreateEventData) {
  const result = await eventsStore.createEvent({
    event_name: data.eventName,
    league_id: leagueId,
    event_datetime: data.eventDate,
    event_round_number: data.numRound,
    event_registration_open: true,
  })

  if (!result.success) return console.error(result.error)

  showCreateModal.value = false
  await refreshEvents()
}

async function updateEvent({ id, data }: UpdateEventData) {
  const result = await eventsStore.updateEvent(id, {
    event_name: data.eventName,
    event_datetime: data.eventDate ?? undefined,
    event_round_number: data.numRound,
  })

  if (!result.success) return console.error(result.error)

  showEventEditModal.value = false
  eventToEdit.value = null
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

  if (!result.success) return console.error('Failed to delete event:', result.error)

  showDeleteConfirm.value = false
  eventToDelete.value = null
  await refreshEvents()
}

// — League —
async function updateLeague({ data }: UpdateLeagueData) {
  const result = await leagueStore.updateLeague(leagueId, {
    name: data.name,
    starts_at: data.startsAt,
    ends_at: data.endsAt,
    ruleset_id: data.rulesetId,
  })

  if (!result.success) return console.error(result.error)
}
</script>

<template>
  <div class="h-full overflow-hidden bg-default">
    <div class="p-6 pb-0">
      <UBreadcrumb :items="breadcrumbItems" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 items-start">

      <!-- Events List -->
      <div class="lg:col-span-2 flex flex-col overflow-hidden">
        <div class="flex items-center justify-between shrink-0 mb-3">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-arrow-left"
            aria-label="Torna indietro"
            @click="router.push('/leagues')"
          >
            Indietro
          </UButton>

          <div class="flex items-center gap-2">
            <h1 class="text-xl font-semibold">
              {{ currentLeague?.name ?? 'Lega' }}
            </h1>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              size="sm"
              aria-label="Modifica nome lega"
              @click="showLeagueEditModal = true"
            />
          </div>

          <UButton
            color="primary"
            icon="i-lucide-plus"
            @click="showCreateModal = true"
          >
            Nuovo Evento
          </UButton>
        </div>

        <EventTable
          :events="events ?? []"
          :loading="eventsLoading"
          class="flex-none"
          @view="navigateToEvent"
          @edit="openEditEvent"
          @delete="openDeleteEvent"
        />

        <div class="mt-3 flex flex-col flex-1 min-h-0 overflow-hidden">
          <h2 class="text-lg font-semibold mb-2 shrink-0">
            Punteggi per Evento
          </h2>
          <EventRanking :league-id="leagueId" class="flex-1 min-h-0 overflow-auto" />
        </div>
      </div>

      <!-- League Standings -->
      <div class="lg:col-span-1 h-full">
        <div class="h-full bg-linear-to-b from-primary/10 to-transparent rounded-xl p-6 border-2 border-primary/30 shadow-lg overflow-hidden flex flex-col">
          <div class="flex items-center justify-center gap-2 mb-4">
            <UIcon name="i-lucide-trophy" class="size-6 text-primary" />
            <h2 class="text-xl font-bold text-center text-primary">
              {{ classificaTitle }}
            </h2>
          </div>

          <ClientOnly>
            <LeagueRanking :standings="standings" class="flex-1 overflow-auto" />
            <template #fallback>
              <div class="flex items-center justify-center py-8">
                <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-primary" />
              </div>
            </template>
          </ClientOnly>
        </div>
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
