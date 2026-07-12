<!-- app\components\Rankings\LeagueStandingsCard.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
import type { StandingWithPlayer } from '#shared/utils/types'

defineProps<{
  title: string
  standings: StandingWithPlayer[]
}>()
</script>

<template>
  <div class="h-full bg-linear-to-b from-primary/10 to-transparent rounded-xl p-6 border-2 border-primary/30 shadow-lg overflow-hidden flex flex-col">
    <div class="flex items-center justify-center gap-2 mb-4">
      <UIcon :name="ICONS.standings" class="size-6 text-primary" />
      <h2 class="text-xl font-bold text-center text-primary">
        {{ title }}
      </h2>
    </div>

    <ClientOnly>
      <LeagueRanking :standings="standings" class="flex-1 overflow-auto" />
      <template #fallback>
        <div class="flex items-center justify-center py-8">
          <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-primary" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
