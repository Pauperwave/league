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
import type { Tournament } from '#shared/utils/types'
import type { TournamentCreatePayload, TournamentUpdatePayload } from '~/components/tournament/modal/TournamentFormModal.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const leagueId = Number(route.params.id)

const {
  createTournament: createEventMutation,
  updateTournament: updateEventMutation,
  deleteTournament: deleteEventMutation
} = useTournamentMutations()

const { data: rulesetsData, isLoading: rulesetsLoading } = useRulesetsQuery()
const rulesets = computed(() => rulesetsData.value ?? [])

// Colada caches (ADR-015): the league's events and its summed standings
// (the latter finally on its own key, no longer sharing the event store's
// standings slot with the per-event standings).
const { data: events, isLoading: eventsLoading } = useEventsQuery(leagueId)
const { data: leagueStandings, error: standingsError } = useLeagueStandingsQuery(leagueId)
const standings = computed(() => leagueStandings.value ?? [])

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

const showTournamentEditModal = ref(false)
const eventToEdit = ref<Tournament | null>(null)

const showDeleteConfirm = ref(false)
const eventToDelete = ref<Tournament | null>(null)

// — Navigation —
function navigateToEvent(event: Tournament) {
  logDebug('LeagueDetailPage', 'Navigating to event', {
    tournamentId: event.tournament_id,
    eventName: event.tournament_name,
    eventPlaying: event.tournament_playing,
    eventRegistrationOpen: event.tournament_registration_open,
    eventCurrentRound: event.tournament_current_round,
    targetUrl: `/league/${leagueId}/event/${event.tournament_id}`,
  })
  router.push(`/league/${leagueId}/event/${event.tournament_id}`)
}

// — Tournament CRUD —
async function createTournament(data: TournamentCreatePayload) {
  try {
    await createEventMutation.mutateAsync({
      tournament_name: data.eventName,
      league_id: leagueId,
      tournament_datetime: data.eventDate,
      tournament_round_number: data.numRound,
      tournament_round_duration: data.roundDuration,
      tournament_registration_open: true,
    })
  } catch (err) {
    toast.add({
      title: t('event.toast.createErrorTitle'),
      description: toErrorMessage(err, t('event.toast.createErrorFallback')),
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
}

async function updateTournament({ id, data }: TournamentUpdatePayload) {
  try {
    await updateEventMutation.mutateAsync({
      id,
      data: {
        tournament_name: data.eventName,
        tournament_datetime: data.eventDate ?? undefined,
        tournament_round_number: data.numRound,
        tournament_round_duration: data.roundDuration,
      },
    })
  } catch (err) {
    toast.add({
      title: t('event.toast.updateErrorTitle'),
      description: toErrorMessage(err, t('event.toast.updateErrorFallback')),
      color: 'error'
    })
    return
  }

  showTournamentEditModal.value = false
  eventToEdit.value = null
  toast.add({
    title: t('event.toast.updatedTitle'),
    description: t('event.toast.updatedDescription', { name: data.eventName }),
    color: 'success'
  })
}

function openEditEvent(event: Tournament) {
  eventToEdit.value = event
  showTournamentEditModal.value = true
}

function openDeleteEvent(event: Tournament) {
  eventToDelete.value = event
  showDeleteConfirm.value = true
}

async function confirmDeleteEvent() {
  if (!eventToDelete.value) return

  try {
    await deleteEventMutation.mutateAsync(eventToDelete.value.tournament_id)
  } catch (err) {
    toast.add({
      title: t('event.toast.deleteErrorTitle'),
      description: isConflictError(err)
        ? t('store.event.inUseError')
        : toErrorMessage(err, t('event.toast.deleteErrorFallback')),
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

      <!-- League Standings — same StandingsCard used on the event page, so the
           two representations of "a ranked list of standings" don't diverge. -->
      <div class="lg:col-span-1">
        <StandingsCard
          :title="classificaTitle"
          :standings="standings" />
      </div>
    </div>

    <!-- Modals -->
    <TournamentFormModal
      v-model:open="showCreateModal"
      :event="null"
      :league-id="leagueId"
      @create="createTournament"
    />

    <TournamentFormModal
      v-model:open="showTournamentEditModal"
      :event="eventToEdit"
      :league-id="leagueId"
      @update="updateTournament"
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
      :subject="eventToDelete?.tournament_name"
      :confirm-icon="ICONS.delete"
      @confirm="confirmDeleteEvent"
    />
  </div>
</template>
