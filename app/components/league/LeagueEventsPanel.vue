<!-- app\components\events\LeagueEventsPanel.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import type { Event, League } from '#shared/utils/types'

const { t } = useI18n()

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
        @click="emit('createEvent')"
      >
        {{ t('league.newEvent') }}
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
        {{ t('league.scoresByEvent') }}
      </h2>
      <EventRanking :league-id="leagueId" class="flex-1 min-h-0 overflow-auto" />
    </div>
  </div>
</template>
