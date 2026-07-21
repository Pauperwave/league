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
const { isDeveloperView } = useDeveloperView()

const displayTitle = computed(() => title ?? t('event.standingsTitleDefault'))

/** How many top rows get the gold/warning highlight (rank badge + score). */
const TOP_PLAYER_COUNT = 8
const isTopPlayer = (index: number) => index < TOP_PLAYER_COUNT

const isOpen = ref(true)
</script>

<template>
  <div class="bg-linear-to-b from-primary/10 to-transparent rounded-xl p-3 border-2 border-primary/30 shadow-lg">
    <UCollapsible v-model:open="isOpen">
      <button type="button" class="flex items-center justify-center gap-1.5 mb-2 w-full cursor-pointer">
        <UIcon :name="ICONS.standings" class="size-4 text-primary" />
        <h4 class="text-base font-bold text-primary">{{ displayTitle }}</h4>
        <UIcon :name="ICONS.chevronDown" class="size-3.5 text-primary transition-transform" :class="isOpen ? '' : '-rotate-90'" />
      </button>

      <template #content>
        <ClientOnly>
          <div v-if="loading" class="flex items-center justify-center py-6">
            <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-primary" />
          </div>
          <div v-else-if="standings.length > 0" class="space-y-1">
            <div
              v-for="(standing, index) in standings"
              :key="standing.player_id"
              class="flex items-center justify-between p-1.5 bg-elevated rounded-lg"
            >
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-5 h-5 flex items-center justify-center rounded-full font-bold text-xs shrink-0"
                    :class="isTopPlayer(index) ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary'"
                  >
                    {{ index + 1 }}
                  </span>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <PlayerNameTag
                        :name="standing.players?.player_name ?? ''"
                        :surname="standing.players?.player_surname ?? ''"
                        :player-id="standing.player_id"
                        avatar-size="md"
                        class="font-medium text-sm"
                      />
                      <UTooltip v-if="submittedByPlayerId[standing.player_id]" :content="{ side: 'top' }" :text="t('event.standingsCard.submittedBadge')">
                        <UIcon :name="ICONS.confirm" class="size-3.5 text-success shrink-0" />
                      </UTooltip>
                    </div>
                    <div v-if="isDeveloperView" class="flex items-center gap-1.5">
                      <div class="flex items-center gap-1 text-md text-muted" :title="t('player.stats.wins')">
                        <UIcon :name="ICONS.victories" class="size-4 text-warning" />
                        <span>{{ standing.victories ?? 0 }}</span>
                      </div>
                      <div class="flex items-center gap-1 text-md text-muted" :title="t('player.stats.kills')">
                        <UIcon :name="ICONS.kills" class="size-4 text-error" />
                        <span>{{ standing.kills ?? 0 }}</span>
                      </div>
                      <div class="flex items-center gap-1 text-md text-muted" :title="t('event.standingsCard.brewVotesTooltip')">
                        <UIcon :name="ICONS.brewVotes" class="size-4 text-info" />
                        <span>{{ standing.brew_received ?? 0 }}</span>
                      </div>
                      <div class="flex items-center gap-1 text-md text-muted" :title="t('event.standingsCard.playVotesTooltip')">
                        <UIcon :name="ICONS.playVotes" class="size-4 text-success" />
                        <span>{{ standing.play_received ?? 0 }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              <span
                class="text-base font-bold shrink-0"
                :class="isTopPlayer(index) ? 'text-warning' : 'text-primary'"
              >{{ standing.standing_player_score ?? 0 }} PT</span>
            </div>
          </div>
          <div v-else class="text-center py-6 text-muted">
            <UIcon :name="ICONS.statsEmpty" class="text-4xl mb-2" />
            <p class="text-sm">{{ t('event.standingsCard.emptyText') }}</p>
          </div>

          <template #fallback>
            <div class="flex items-center justify-center py-6">
              <UIcon :name="ICONS.loading" class="animate-spin text-2xl text-primary" />
            </div>
          </template>
        </ClientOnly>
      </template>
    </UCollapsible>
  </div>
</template>
