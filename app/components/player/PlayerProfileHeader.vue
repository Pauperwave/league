<!-- app\components\player\PlayerProfileHeader.vue -->
<script setup lang="ts">
import type { Player } from '#shared/utils/types'

interface PlayerStats {
  events_played: number
  total_matches: number
  total_wins: number
  total_kills: number
  average_score: number
}

interface Props {
  player: Player
  playerStats?: PlayerStats | null
  ownedDeckCount: number
  borrowedDeckCount: number
}

const { player, playerStats = null, ownedDeckCount, borrowedDeckCount } = defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <div class="bg-elevated rounded-xl p-6 border border-default shadow-lg space-y-6">
    <!-- Profile Header -->
    <div class="space-y-1">
      <PlayerNameTag
        :name="player.player_name"
        :surname="player.player_surname"
        :player-id="player.player_id"
        :linkable="false"
        avatar-size="lg"
        class="text-2xl font-bold"
      />
      <p class="text-muted text-sm">ID: {{ player.player_id }}</p>
    </div>

    <!-- Player Stats — compact horizontal bar -->
    <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
      <StatTile
        background="bg-elevated"
        :icon="ICONS.calendarDays"
        :value="playerStats?.events_played ?? 0"
        :label="t('player.stats.events')"
      />
      <StatTile
        background="bg-elevated"
        :icon="ICONS.battle"
        :value="playerStats?.total_matches ?? 0"
        :label="t('player.stats.matches')"
      />
      <StatTile
        background="bg-elevated"
        :icon="ICONS.standings"
        color="text-warning"
        :value="playerStats?.total_wins ?? 0"
        :label="t('player.stats.wins')"
      />
      <StatTile
        background="bg-elevated"
        :icon="ICONS.kills"
        color="text-error"
        :value="playerStats?.total_kills ?? 0"
        :label="t('player.stats.kills')"
      />
      <StatTile
        background="bg-elevated"
        :icon="ICONS.vote"
        color="text-success"
        :value="playerStats?.average_score ?? 0"
        :label="t('player.stats.average')"
      />

      <div class="flex items-center gap-3 p-3 bg-elevated rounded-lg">
        <UIcon :name="ICONS.commander" class="size-5 text-info shrink-0" />
        <div>
          <p class="text-xl font-bold leading-none">{{ ownedDeckCount }}</p>
          <p class="text-xs text-muted">{{ t('player.stats.decks') }}</p>
          <p v-if="borrowedDeckCount > 0" class="text-xs text-warning">+{{ borrowedDeckCount }} {{ t('player.stats.borrowedSuffix') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
