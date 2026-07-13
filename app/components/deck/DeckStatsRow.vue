<!-- app\components\deck\DeckStatsRow.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'

interface Props {
  firstIcon: string
  firstValue: number
  firstLabel: string
  matches: number
  wins: number
  kills: number
  average: number
}

const { firstIcon, firstValue, firstLabel, matches, wins, kills, average } = defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <div class="grid grid-cols-3 sm:grid-cols-5 gap-3">
    <StatTile :icon="firstIcon" :value="firstValue" :label="firstLabel" />
    <StatTile :icon="ICONS.battle" :value="matches" :label="t('player.stats.matches')" />
    <StatTile :icon="ICONS.standings" color="text-warning" :value="wins" :label="t('player.stats.wins')" />
    <StatTile :icon="ICONS.kills" color="text-error" :value="kills" :label="t('player.stats.kills')" />
    <StatTile :icon="ICONS.vote" color="text-success" :value="average" :label="t('player.stats.average')" />
  </div>
</template>
