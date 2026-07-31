<!-- app\components\tournament\TournamentRanking.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- coincidental generic <table> markup, unrelated to PlayerMatchHistoryTable's feature
import { compareStandings } from '#shared/utils/standingsSort'
import type { StandingSortable } from '#shared/utils/standingsSort'
import type { Player } from '#shared/utils/types'

const props = defineProps<{
  leagueId: number
}>()

const { t } = useI18n()

// Colada cache of the league's tournaments (ADR-015)
const { data: tournamentsData, isLoading: loading } = useEventsQuery(props.leagueId)

const allLeagueTournaments = computed(() => {
  const tournaments = tournamentsData.value ?? []
  return [...tournaments].sort((a, b) => {
    const dateA = a.tournament_datetime ?? ''
    const dateB = b.tournament_datetime ?? ''
    return dateA.localeCompare(dateB)
  })
})

// Standings across all the league's tournaments (Colada, ADR-015)
const tournamentIds = computed(() => tournamentsData.value?.map(e => e.tournament_id) ?? [])
const { data: allStandings } = useMultipleEventStandingsQuery(tournamentIds)

// Group standings by tournament
const tournamentStandings = computed(() => {
  if (!tournamentsData.value) return []

  return tournamentsData.value.map(tournament => ({
    tournament,
    standings: (allStandings.value ?? []).filter(s => s.tournament_id === tournament.tournament_id)
  }))
})

const allPlayers = computed(() => {
  const playerMap = new Map<number, Player>()
  for (const ts of tournamentStandings.value) {
    for (const standing of ts.standings) {
      if (standing.players && !playerMap.has(standing.player_id)) {
        playerMap.set(standing.player_id, standing.players)
      }
    }
  }
  return Array.from(playerMap.values()).sort((a, b) =>
    (a.player_name ?? '').localeCompare(b.player_name ?? '')
  )
})

const standingsTotals = computed(() => {
  const totalsMap = new Map<number, StandingSortable>()
  for (const ts of tournamentStandings.value) {
    for (const standing of ts.standings) {
      const current = totalsMap.get(standing.player_id) ?? {
        player_id: standing.player_id,
        standing_player_score: 0,
        victories: 0,
        kills: 0,
        brew_received: 0,
        play_received: 0,
      }
      totalsMap.set(standing.player_id, {
        player_id: standing.player_id,
        standing_player_score: (current.standing_player_score ?? 0) + (standing.standing_player_score ?? 0),
        victories: (current.victories ?? 0) + (standing.victories ?? 0),
        kills: (current.kills ?? 0) + (standing.kills ?? 0),
        brew_received: (current.brew_received ?? 0) + (standing.brew_received ?? 0),
        play_received: (current.play_received ?? 0) + (standing.play_received ?? 0),
      })
    }
  }
  return totalsMap
})

const totalScore = computed(() => {
  const scoreMap = new Map<number, number>()
  for (const [playerId, totals] of standingsTotals.value) {
    scoreMap.set(playerId, totals.standing_player_score ?? 0)
  }
  return scoreMap
})

const sortedPlayers = computed(() => {
  const fallback = (playerId: number): StandingSortable => ({
    player_id: playerId,
    standing_player_score: 0,
    victories: 0,
    kills: 0,
    brew_received: 0,
    play_received: 0,
  })

  return [...allPlayers.value].sort((a, b) =>
    compareStandings(
      standingsTotals.value.get(a.player_id) ?? fallback(a.player_id),
      standingsTotals.value.get(b.player_id) ?? fallback(b.player_id),
    ),
  )
})

function getScore(playerId: number, tournamentId: number): number | null {
  const ts = tournamentStandings.value.find(t => t.tournament.tournament_id === tournamentId)
  if (!ts) return null
  const standing = ts.standings.find(s => s.player_id === playerId)
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
            {{ t('league.ranking.player') }}
          </th>
          <th
            v-for="tournament in allLeagueTournaments"
            :key="tournament.tournament_id"
            class="px-3 py-2 text-center font-semibold whitespace-nowrap"
          >
            {{ tournament.tournament_name }}
          </th>
          <th class="px-3 py-2 text-right font-semibold bg-primary/10">
            {{ t('tournament.scoreBreakdown.playerTotal') }}
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
          <td class="px-3 py-2">
            <PlayerNameTag
              :name="player.player_name ?? ''"
              :surname="player.player_surname ?? ''"
              :player-id="player.player_id"
              avatar-size="xs"
            />
          </td>
          <td
            v-for="tournament in allLeagueTournaments"
            :key="`${player.player_id}-${tournament.tournament_id}`"
            class="px-3 py-2 text-center"
          >
            {{ getScore(player.player_id, tournament.tournament_id) ?? "-" }}
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
        :name="ICONS.loading"
        class="animate-spin text-2xl text-primary"
      />
    </div>

    <div
      v-else-if="allLeagueTournaments.length === 0"
      class="text-center py-8 text-muted"
    >
      <UIcon
        :name="ICONS.standings"
        class="text-4xl mb-2 opacity-30"
      />
      <p>{{ t('league.ranking.empty') }}</p>
    </div>
  </div>
</template>
