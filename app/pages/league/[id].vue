<!-- app\pages\league\[id].vue -->
<!--
  The param is [id], NOT [leagueId], ON PURPOSE — do not "fix" it.
  If this file were league/[leagueId].vue, it would pair with the sibling
  league/[leagueId]/ folder as a NESTED route: named parent routes take
  priority over nested dynamic routes (Nuxt pages docs), so navigating to
  /league/7/event/12 would render THIS page instead of the event page unless
  this page embedded <NuxtPage>. The mismatched param name keeps the two
  routes flat and independent. See docs/architecture/routes.md § "Nested
  route gotcha".
-->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- LeagueFormModal/ConfirmModal invocation boilerplate shared with leagues.vue
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

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const leagueId = Number(route.params.id)

const eventsStore = useEventStore()

const { standings } = storeToRefs(eventsStore)

const { data: rulesetsData, isLoading: rulesetsLoading } = useRulesetsQuery()
const rulesets = computed(() => rulesetsData.value ?? [])

const { data: events, pending: eventsLoading, refresh: refreshEvents } = useEvents(leagueId)

// Colada resolves the league from the cached list (SSR-prefetched) — no
// store, no manual fetch fallback (ADR-015).
const { league: currentLeague } = useLeagueById(leagueId)
const classificaTitle = computed(() =>
  t('league.standingsTitle', { name: currentLeague.value?.name ?? '' }).trim()
)

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('league.breadcrumb'), to: '/leagues' },
  { label: currentLeague.value?.name ?? t('league.fallbackName') },
])

const { error: standingsError } = await useAsyncData(`league-standings-${leagueId}`, () => eventsStore.fetchLeagueStandings(leagueId))

onMounted(() => {
  if (standingsError.value) {
    toast.add({
      title: t('league.toast.standingsErrorTitle'),
      description: standingsError.value.message || t('league.toast.standingsErrorFallback'),
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
  logDebug('LeagueDetailPage', 'Navigating to event', {
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
      title: t('event.toast.createErrorTitle'),
      description: result.error || t('event.toast.createErrorFallback'),
      color: 'error'
    })
    return
  }

  showCreateModal.value = false
  toast.add({
    title: t('event.toast.createdTitle'),
    description: t('event.toast.createdDescription', { name: data.eventName }),
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
      title: t('event.toast.updateErrorTitle'),
      description: result.error || t('event.toast.updateErrorFallback'),
      color: 'error'
    })
    return
  }

  showEventEditModal.value = false
  eventToEdit.value = null
  toast.add({
    title: t('event.toast.updatedTitle'),
    description: t('event.toast.updatedDescription', { name: data.eventName }),
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
      title: t('event.toast.deleteErrorTitle'),
      description: result.error || t('event.toast.deleteErrorFallback'),
      color: 'error'
    })
    return
  }

  showDeleteConfirm.value = false
  eventToDelete.value = null
  toast.add({
    title: t('event.toast.deletedTitle'),
    description: t('event.toast.deletedDescription'),
    color: 'success'
  })
  await refreshEvents()
}

const { updateLeague } = useLeagueUpdate(() => {
  showLeagueEditModal.value = false
})
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
      :description="t('league.confirmDeleteEventDescription')"
      :question="t('league.confirmDeleteEventQuestion')"
      :subject="eventToDelete?.event_name"
      :confirm-icon="ICONS.delete"
      @confirm="confirmDeleteEvent"
    />
  </div>
</template>
