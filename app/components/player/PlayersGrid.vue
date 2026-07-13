<!-- app\components\player\PlayersGrid.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'
import type { SortField } from '~/composables/players/usePlayersFilter'

const props = defineProps<{
  players: Player[]
  sortBy: SortField
  getSortLabel: (v: string) => string
  getPlayerStat: (id: number, key: string) => number
}>()

function resolveStatKey(sort: SortField) {
  const map: Partial<Record<SortField, string>> = {
    wins: 'total_wins', kills: 'total_kills',
    matches: 'total_matches', events: 'events_played', avgScore: 'average_score'
  }
  return map[sort]
}

function getStatValue(playerId: number) {
  const key = resolveStatKey(props.sortBy)
  if (!key) return undefined
  const val = props.getPlayerStat(playerId, key)
  return props.sortBy === 'avgScore' ? val.toFixed(2) : String(val)
}
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    <PlayerCard
      v-for="player in players"
      :key="player.player_id"
      :player="player"
      :stat-label="sortBy !== 'name' && sortBy !== 'decks' ? getSortLabel(sortBy) : undefined"
      :stat-value="getStatValue(player.player_id)"
    />
  </div>
</template>
