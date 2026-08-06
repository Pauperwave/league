<!-- app\components\tournament\TournamentAwards.vue -->
<script setup lang="ts">
import type { StandingWithPlayer } from '#shared/utils/types'

const { standings, victimCounts } = defineProps<{
  standings: StandingWithPlayer[]
  victimCounts: Map<number, number>
}>()

const { t } = useI18n()

const standingsRef = toRef(() => standings)
const victimCountsRef = toRef(() => victimCounts)
const awards = useTournamentAwards(standingsRef, victimCountsRef)
</script>

<template>
  <div v-if="awards.length > 0" class="space-y-2">
    <h3 class="font-semibold text-lg flex items-center gap-2">
      <UIcon :name="ICONS.standings" class="text-primary" />
      {{ t('tournament.awards.sectionTitle') }}
    </h3>
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <TournamentAwardCard
        v-for="award in awards"
        :key="award.kind"
        :kind="award.kind"
        :player-id="award.playerId"
        :player-name="award.playerName"
        :player-surname="award.playerSurname"
        :value="award.value"
      />
    </div>
  </div>
</template>
