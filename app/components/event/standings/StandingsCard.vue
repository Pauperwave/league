<!-- app\components\event\standings\StandingsCard.vue -->
<script setup lang="ts">

interface Standing {
  player_id: number
  standing_player_score: number | null
  victories: number | null
  kills?: number | null
  brew_received?: number | null
  play_received?: number | null
  players?: {
    player_name: string
    player_surname: string
  }
}

const {
  standings,
  loading = false,
  title,
  submittedByPlayerId = {},
} = defineProps<{
  standings: Standing[]
  loading?: boolean
  title?: string
  submittedByPlayerId?: Record<number, boolean>
}>()

const { t } = useI18n()

const displayTitle = computed(() => title ?? t('event.standingsTitleDefault'))
</script>

<template>
  <div class="bg-linear-to-b from-primary/10 to-transparent rounded-xl p-6 border-2 border-primary/30 shadow-lg">
    <div class="flex items-center justify-center gap-2 mb-4">
      <UIcon :name="ICONS.standings" class="size-5 text-primary" />
      <h4 class="text-lg font-bold text-primary">{{ displayTitle }}</h4>
    </div>

    <ClientOnly>
      <div v-if="loading" class="flex items-center justify-center py-8">
        <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-primary" />
      </div>
      <div v-else-if="standings.length > 0" class="space-y-2">
        <div
          v-for="(standing, index) in standings"
          :key="standing.player_id"
          class="flex items-center justify-between p-3 bg-elevated rounded-lg"
        >
            <div class="flex items-center gap-3">
              <span class="w-6 h-6 flex items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">
                {{ index + 1 }}
              </span>
              <div class="min-w-0">
                <PlayerNameTag
                  :name="standing.players?.player_name ?? ''"
                  :surname="standing.players?.player_surname ?? ''"
                  :show-avatar="false"
                  class="font-medium text-sm"
                />
                 <div class="flex items-center gap-2">
                   <div class="flex items-center gap-1 text-xs text-muted" :title="t('player.stats.wins')">
                     <UIcon :name="ICONS.victories" class="size-3 text-warning" />
                     <span>{{ standing.victories ?? 0 }}</span>
                   </div>
                   <div class="flex items-center gap-1 text-xs text-muted" :title="t('player.stats.kills')">
                     <UIcon :name="ICONS.kills" class="size-3 text-error" />
                     <span>{{ standing.kills ?? 0 }}</span>
                   </div>
                   <div class="flex items-center gap-1 text-xs text-muted" :title="t('event.standingsCard.brewVotesTooltip')">
                     <UIcon :name="ICONS.brewVotes" class="size-3 text-info" />
                     <span>{{ standing.brew_received ?? 0 }}</span>
                   </div>
                   <div class="flex items-center gap-1 text-xs text-muted" :title="t('event.standingsCard.playVotesTooltip')">
                     <UIcon :name="ICONS.playVotes" class="size-3 text-success" />
                     <span>{{ standing.play_received ?? 0 }}</span>
                   </div>
                   <UBadge
                    v-if="submittedByPlayerId[standing.player_id]"
                    size="sm"
                    color="success"
                    variant="soft"
                    class="text-sm px-2 py-1"
                  >
                    {{ t('event.standingsCard.submittedBadge') }}
                  </UBadge>
                </div>
              </div>
            </div>
          <span class="text-lg font-bold text-primary">{{ standing.standing_player_score ?? 0 }} PT</span>
        </div>
      </div>
      <div v-else class="text-center py-8 text-muted">
        <UIcon :name="ICONS.statsEmpty" class="text-4xl mb-2" />
        <p class="text-sm">{{ t('event.standingsCard.emptyText') }}</p>
      </div>

      <template #fallback>
        <div class="flex items-center justify-center py-8">
          <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-primary" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
