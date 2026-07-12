<!-- app\components\events\LeagueEventsPanel.vue -->
<script setup lang="ts">
import type { Event, League } from '#shared/utils/types'

const {
  leagueId,
  currentLeague = null,
  events = [],
  eventsLoading = false
} = defineProps<{
  leagueId: number
  currentLeague?: League | null
  events?: Event[]
  eventsLoading?: boolean
}>()

const emit = defineEmits<{
  editLeague: []
  createEvent: []
  viewEvent: [event: Event]
  editEvent: [event: Event]
  deleteEvent: [event: Event]
}>()

const router = useRouter()
</script>

<template>
  <div class="flex flex-col overflow-hidden h-full">
    <div class="flex items-center justify-between shrink-0 mb-3">
      <UButton
        color="neutral"
        icon="i-lucide-arrow-left"
        aria-label="Torna indietro"
        @click="() => { router.push('/leagues') }"
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
          @click="emit('editLeague')"
        />
      </div>

      <UButton
        color="primary"
        icon="i-lucide-plus"
        @click="emit('createEvent')"
      >
        Nuovo Evento
      </UButton>
    </div>

    <EventTable
      :events="events"
      :loading="eventsLoading"
      class="flex-none"
      @view="(e) => emit('viewEvent', e)"
      @edit="(e) => emit('editEvent', e)"
      @delete="(e) => emit('deleteEvent', e)"
    />

    <div class="mt-3 flex flex-col flex-1 min-h-0 overflow-hidden">
      <h2 class="text-lg font-semibold mb-2 shrink-0">
        Punteggi per Evento
      </h2>
      <EventRanking :league-id="leagueId" class="flex-1 min-h-0 overflow-auto" />
    </div>
  </div>
</template>
