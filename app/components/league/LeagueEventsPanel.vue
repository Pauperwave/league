<!-- app\components\league\LeagueEventsPanel.vue -->
<script setup lang="ts">
import type { Tournament, League } from '#shared/utils/types'

const { t } = useI18n()

const {
  leagueId,
  currentLeague = null,
  events = [],
  eventsLoading = false
} = defineProps<{
  leagueId: number
  currentLeague?: League | null
  events?: Tournament[]
  eventsLoading?: boolean
}>()

const emit = defineEmits<{
  editLeague: []
  createTournament: []
  viewTournament: [event: Tournament]
  editTournament: [event: Tournament]
  deleteTournament: [event: Tournament]
}>()

const router = useRouter()
</script>

<template>
  <div class="flex flex-col overflow-hidden h-full">
    <div class="flex items-center justify-between shrink-0 mb-3">
      <UButton
        color="neutral"
        :icon="ICONS.back"
        :aria-label="t('league.backAriaLabel')"
        @click="() => { router.push('/leagues') }"
      >
        {{ t('common.back') }}
      </UButton>

      <div class="flex items-center gap-2">
        <h1 class="text-xl font-semibold">
          {{ currentLeague?.name ?? t('league.fallbackName') }}
        </h1>
        <UButton
          color="neutral"
          variant="ghost"
          :icon="ICONS.edit"
          size="sm"
          :aria-label="t('league.editLeagueName')"
          @click="emit('editLeague')"
        />
      </div>

      <UButton
        color="primary"
        :icon="ICONS.add"
        @click="emit('createTournament')"
      >
        {{ t('league.newEvent') }}
      </UButton>
    </div>

    <TournamentsTable
      :events="events"
      :loading="eventsLoading"
      class="flex-none"
      @view="(e) => emit('viewTournament', e)"
      @edit="(e) => emit('editTournament', e)"
      @delete="(e) => emit('deleteTournament', e)"
    />

    <div class="mt-3 flex flex-col flex-1 min-h-0 overflow-hidden">
      <h2 class="text-lg font-semibold mb-2 shrink-0">
        {{ t('league.scoresByEvent') }}
      </h2>
      <TournamentRanking :league-id="leagueId" class="flex-1 min-h-0 overflow-auto" />
    </div>
  </div>
</template>
