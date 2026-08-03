<!-- app\components\standings\StandingsCard.vue -->
<script setup lang="ts">
import type { StandingWithPlayer } from '#shared/utils/types'

const {
  standings,
  loading = false,
  title,
  submittedByPlayerId = {},
} = defineProps<{
  standings: StandingWithPlayer[]
  loading?: boolean
  title?: string
  submittedByPlayerId?: Record<number, boolean>
}>()

const { t } = useI18n()
const { isDeveloperView } = useDeveloperView()
const { copy } = useClipboard()
const toast = useToast()

const displayTitle = computed(() => title ?? t('tournament.standingsTitleDefault'))

/** How many top rows get the gold/warning highlight (rank badge + score). */
const TOP_PLAYER_COUNT = 8
const isTopPlayer = (index: number) => index < TOP_PLAYER_COUNT

const isOpen = ref(true)

/** "posizionamento / nome e cognome / punti totali" — one line per player, in current ranking order. */
const standingsText = computed(() =>
  standings
    .map((s, i) => `${i + 1}. ${s.players?.player_name ?? ''} ${s.players?.player_surname ?? ''} - ${s.standing_player_score ?? 0} PT`.trim())
    .join('\n')
)

const copyStandingsLogging = useButtonLogging(t('logging.standings.copy'))

async function handleCopyStandings() {
  copyStandingsLogging.logClick()
  await copy(standingsText.value)
  toast.add({ title: t('tournament.standingsCard.copySuccessTitle'), color: 'success' })
}

// ─── Fullscreen ───────────────────────────────────────────────────────────────
// Same pattern as PairingsCard.vue/RoundTimer.vue: browser Fullscreen API on a
// wrapping ref, so the ranking is readable across a room (projector/TV).
const standingsRef = useTemplateRef<HTMLDivElement>('standingsRef')
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(standingsRef)

const toggleFullscreenLogging = useButtonLogging(t('logging.standings.toggleFullscreen'), {
  isFullscreen: () => isFullscreen.value,
})

function handleToggleFullscreen() {
  toggleFullscreenLogging.logClick()
  toggleFullscreen()
}
</script>

<template>
  <div
    ref="standingsRef"
    class="bg-linear-to-b from-primary/10 to-transparent rounded-xl p-3 border-2 border-primary/30 shadow-lg"
    :class="isFullscreen ? 'h-screen w-screen overflow-auto bg-default flex flex-col' : ''"
  >
    <div class="flex items-center justify-end gap-1 mb-1">
      <UTooltip :content="{ side: 'top' }" :text="t('tournament.standingsCard.copyTooltip')">
        <UButton
          :icon="ICONS.copy"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="t('tournament.standingsCard.copyTooltip')"
          @click="handleCopyStandings"
        />
      </UTooltip>
      <UTooltip
        :content="{ side: 'top' }"
        :text="isFullscreen
          ? t('tournament.standingsCard.exitFullscreenTooltip')
          : t('tournament.standingsCard.fullscreenTooltip')"
      >
        <UButton
          :icon="isFullscreen ? ICONS.collapse : ICONS.expand"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="isFullscreen
            ? t('tournament.standingsCard.exitFullscreenTooltip')
            : t('tournament.standingsCard.fullscreenTooltip')"
          @click="handleToggleFullscreen"
        />
      </UTooltip>
    </div>
    <UCollapsible v-model:open="isOpen">
      <button type="button" class="flex items-center justify-center gap-1.5 mb-2 w-full cursor-pointer">
        <UIcon :name="ICONS.standings" class="text-primary" :class="isFullscreen ? 'size-8' : 'size-4'" />
        <h4 class="font-bold text-primary" :class="isFullscreen ? 'text-3xl' : 'text-base'">{{ displayTitle }}</h4>
        <UIcon
          :name="ICONS.chevronDown"
          class="size-3.5 text-primary transition-transform"
          :class="isOpen ? '' : '-rotate-90'"
        />
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
              class="flex items-center justify-between bg-elevated rounded-lg"
              :class="isFullscreen ? 'p-3' : 'p-1.5'"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="flex items-center justify-center rounded-full font-bold shrink-0"
                  :class="[
                    isTopPlayer(index)
                      ? 'bg-warning/20 text-warning'
                      : 'bg-primary/20 text-primary',
                    isFullscreen ? 'w-10 h-10 text-xl' : 'w-5 h-5 text-xs',
                  ]"
                >
                  {{ index + 1 }}
                </span>
                <div class="min-w-0" :class="isFullscreen ? 'text-2xl' : ''">
                  <div class="flex items-center gap-1.5">
                    <PlayerNameTag
                      :name="standing.players?.player_name ?? ''"
                      :surname="standing.players?.player_surname ?? ''"
                      :player-id="standing.player_id"
                      :avatar-size="isFullscreen ? 'lg' : 'md'"
                      class="font-medium"
                      :class="isFullscreen ? 'text-2xl' : 'text-sm'"
                    />
                    <UTooltip
                      v-if="submittedByPlayerId[standing.player_id]"
                      :content="{ side: 'top' }"
                      :text="t('tournament.standingsCard.submittedBadge')"
                    >
                      <UIcon :name="ICONS.confirm" class="size-3.5 text-success shrink-0" />
                    </UTooltip>
                  </div>
                  <div v-if="isDeveloperView" class="flex items-center gap-1.5">
                    <div class="flex items-center gap-1 text-md text-muted" :title="t('player.stats.wins')">
                      <UIcon :name="ICONS.victories" class="size-4 text-warning" />
                      <span>{{ standing.victories ?? 0 }}</span>
                    </div>
                    <div
                      class="flex items-center gap-1 text-md text-muted"
                      :title="t('tournament.tableScoresModal.placementColumn')"
                    >
                      <UIcon :name="ICONS.standings" class="size-4 text-primary" />
                      <span>{{ standing.placementPoints ?? 0 }}</span>
                    </div>
                    <div class="flex items-center gap-1 text-md text-muted" :title="t('player.stats.kills')">
                      <UIcon :name="ICONS.kills" class="size-4 text-error" />
                      <span>{{ standing.killPoints ?? 0 }}</span>
                    </div>
                    <div
                      class="flex items-center gap-1 text-md text-muted"
                      :title="t('tournament.standingsCard.brewVotesTooltip')"
                    >
                      <UIcon :name="ICONS.brewVotes" class="size-4 text-info" />
                      <span>{{ standing.brewPoints ?? 0 }}</span>
                    </div>
                    <div
                      class="flex items-center gap-1 text-md text-muted"
                      :title="t('tournament.standingsCard.playVotesTooltip')"
                    >
                      <UIcon :name="ICONS.playVotes" class="size-4 text-success" />
                      <span>{{ standing.playPoints ?? 0 }}</span>
                    </div>
                    <UTooltip
                      v-if="standing.paymentMethod"
                      :content="{ side: 'top' }"
                      :text="t(PAYMENT_METHOD_DISPLAY[standing.paymentMethod].labelKey)"
                    >
                      <UIcon
                        :name="PAYMENT_METHOD_DISPLAY[standing.paymentMethod].icon"
                        class="size-4"
                        :class="PAYMENT_METHOD_DISPLAY[standing.paymentMethod].textClass"
                      />
                    </UTooltip>
                  </div>
                </div>
              </div>
              <span
                class="font-bold shrink-0"
                :class="[isTopPlayer(index) ? 'text-warning' : 'text-primary', isFullscreen ? 'text-3xl' : 'text-base']"
              >{{ standing.standing_player_score ?? 0 }} PT</span>
            </div>
          </div>
          <div v-else class="text-center py-6 text-muted">
            <UIcon :name="ICONS.statsEmpty" class="text-4xl mb-2" />
            <p class="text-sm">{{ t('tournament.standingsCard.emptyText') }}</p>
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
