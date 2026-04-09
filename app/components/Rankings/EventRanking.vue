<!-- app\components\Rankings\EventRanking.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'

interface Props {
  leagueId: number
}

const props = defineProps<Props>()

// Usa il composable SSR-friendly per eventi
const { data: eventsData, pending: loading } = useEvents(props.leagueId)

const allLeagueEvents = computed(() => {
  const events = eventsData.value ?? []
  return [...events].sort((a, b) => {
    const dateA = a.event_datetime ?? ''
    const dateB = b.event_datetime ?? ''
    return dateA.localeCompare(dateB)
  })
})

// Fetch all standings for all events via composable -> store chain
const eventIds = computed(() => eventsData.value?.map(e => e.event_id) ?? [])
const { data: allStandings } = useMultipleEventStandings(eventIds)

// Group standings by event
const eventStandings = computed(() => {
  if (!eventsData.value) return []

  return eventsData.value.map(event => ({
    event,
    standings: (allStandings.value ?? []).filter(s => s.event_id === event.event_id)
  }))
})

const allPlayers = computed(() => {
  const playerMap = new Map<number, Player>()
  for (const es of eventStandings.value) {
    for (const standing of es.standings) {
      if (standing.players && !playerMap.has(standing.player_id)) {
        playerMap.set(standing.player_id, standing.players)
      }
    }
  }
  return Array.from(playerMap.values()).sort((a, b) =>
    (a.player_name ?? '').localeCompare(b.player_name ?? '')
  )
})

const totalScore = computed(() => {
  const scoreMap = new Map<number, number>()
  for (const es of eventStandings.value) {
    for (const standing of es.standings) {
      const current = scoreMap.get(standing.player_id) ?? 0
      scoreMap.set(standing.player_id, current + (standing.standing_player_score ?? 0))
    }
  }
  return scoreMap
})

const sortedPlayers = computed(() => {
  return [...allPlayers.value].sort((a, b) => {
    const scoreA = totalScore.value.get(a.player_id) ?? 0
    const scoreB = totalScore.value.get(b.player_id) ?? 0
    return scoreB - scoreA
  })
})

function getScore(playerId: number, eventId: number): number | null {
  const es = eventStandings.value.find(e => e.event.event_id === eventId)
  if (!es) return null
  const standing = es.standings.find(s => s.player_id === playerId)
  return standing?.standing_player_score ?? null
}
</script>

<template>
  <div
    class="overflow-x-auto overflow-y-auto"
    tabindex="0"
  >
    <table
      v-if="sortedPlayers.length > 0"
      class="w-full text-sm border border-default rounded-lg"
    >
      <thead>
        <tr class="border-b border-default">
          <th class="px-3 py-2 text-center font-semibold w-12">
            #
          </th>
          <th class="px-3 py-2 text-left font-semibold">
            Giocatore
          </th>
          <th
            v-for="event in allLeagueEvents"
            :key="event.event_id"
            class="px-3 py-2 text-center font-semibold whitespace-nowrap"
          >
            {{ event.event_name }}
          </th>
          <th class="px-3 py-2 text-right font-semibold bg-primary/10">
            Totale
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(player, index) in sortedPlayers"
          :key="player.player_id"
          class="border-b border-default hover:bg-muted/30"
        >
          <td class="px-3 py-2 text-center font-medium">
            {{ index + 1 }}
          </td>
          <td class="px-3 py-2 font-medium whitespace-nowrap">
            {{ player.player_name }}
            <span class="font-bold text-primary">{{ player.player_surname }}</span>
          </td>
          <td
            v-for="event in allLeagueEvents"
            :key="`${player.player_id}-${event.event_id}`"
            class="px-3 py-2 text-center"
          >
            {{ getScore(player.player_id, event.event_id) ?? "-" }}
          </td>
          <td class="px-3 py-2 text-right font-bold bg-primary/10">
            {{ totalScore.get(player.player_id) ?? 0 }}
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-if="loading"
      class="flex items-center justify-center py-8"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin text-2xl text-primary"
      />
    </div>

    <div
      v-else-if="allLeagueEvents.length === 0"
      class="text-center py-8 text-muted"
    >
      <UIcon
        name="i-lucide-trophy"
        class="text-4xl mb-2 opacity-30"
      />
      <p>Nessun punteggio disponibile</p>
    </div>
  </div>
</template>
