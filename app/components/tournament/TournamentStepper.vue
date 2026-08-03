<!-- app\components\tournament\TournamentStepper.vue -->
<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'
import type { TournamentStatus } from '#shared/utils/types'

const { t } = useI18n()

const {
  currentRound,
  totalRounds,
  tournamentStatus,
  viewedRound = null,
  viewingRegistration = false
} = defineProps<{
  /** Current round number (1-based) */
  currentRound: number
  /** Total number of rounds in the tournament */
  totalRounds: number
  /** Current tournament status */
  tournamentStatus: TournamentStatus
  /** Round currently being viewed (read-only preview of a past round), if any */
  viewedRound?: number | null
  /** True while showing the read-only past-registration table */
  viewingRegistration?: boolean
}>()

const stepper = useTemplateRef('stepper')

const emit = defineEmits<{
  viewRound: [round: number]
  viewRegistration: []
}>()

defineSlots<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: (props: { item: StepperItem }) => any
}>()

// advance-round.post.ts leaves tournament_current_round at totalRounds + 1
// once a tournament ends (its "one past the last round" convention) — so
// currentRound is NOT the last playable round once ended. Every "is this the
// last round" check below must go through this instead of currentRound.
const lastPlayableRound = computed(() => tournamentStatus === 'ended' ? totalRounds : currentRound)

function roundStepDescription(i: number, isCorrecting: boolean, isViewed: boolean): string {
  if (isCorrecting) return t('tournament.stepper.roundCorrecting')
  if (isViewed) return t('tournament.stepper.roundViewing')
  if (i < currentRound) return t('tournament.stepper.roundCompleted')
  if (i === currentRound) return t('tournament.stepper.roundInProgress')
  return t('tournament.stepper.roundPending')
}

const items = computed<StepperItem[]>(() => {
  const steps: StepperItem[] = [
    {
      title: t('tournament.stepper.registrationTitle'),
      description: viewingRegistration
        ? t('tournament.stepper.registrationViewing')
        : t('tournament.stepper.registrationDescription'),
      icon: viewingRegistration ? ICONS.show : ICONS.registration,
      value: 'registration',
      ui: viewingRegistration ? { trigger: 'bg-primary text-inverted' } : undefined,
    },
  ]

  for (let i = 1; i <= totalRounds; i++) {
    const isViewed = viewedRound === i
    const isCorrecting = isViewed && tournamentStatus === 'ended' && i === lastPlayableRound.value
    steps.push({
      title: t('tournament.stepper.roundTitle', { n: i }),
      description: roundStepDescription(i, isCorrecting, isViewed),
      icon: isViewed ? ICONS.show : ICONS.battle,
      value: `round-${i}`,
      // Distinct trigger color so a viewed past round reads as "previewing",
      // not as the tournament's actual current-round progress marker.
      ui: isViewed ? { trigger: 'bg-primary text-inverted' } : undefined,
    })
  }

  steps.push({
    title: t('tournament.status.ended'),
    description: t('tournament.stepper.endedDescription'),
    icon: ICONS.flag,
    value: 'ended',
  })

  return steps
})

const currentStep = computed(() => {
  if (tournamentStatus === 'ended') return 'ended'
  if (currentRound > 0) return `round-${currentRound}`
  return 'registration'
})

// Follows the viewed round/registration when previewing, otherwise the
// tournament's actual current step — so the stepper's active indicator
// tracks what's on screen instead of always snapping back.
const displayStep = computed(() => {
  if (viewingRegistration) return 'registration'
  if (viewedRound !== null) return `round-${viewedRound}`
  return currentStep.value
})

const internalStep = ref(displayStep.value)
watch(displayStep, (val) => { internalStep.value = val })

/** The round being navigated to in the last handleStepClick call, for logging context. */
const lastViewedRound = ref(0)

const viewRoundLogging = useButtonLogging(t('logging.tournament.viewRound'), {
  round: () => lastViewedRound.value,
  currentRound: () => currentRound,
})

const viewRegistrationLogging = useButtonLogging(t('logging.tournament.viewRegistration'), {
  currentRound: () => currentRound,
})

function handleStepClick(value: string | number | undefined) {
  // Once the tournament has left registration, that step becomes the
  // read-only "who signed up, when, how they paid" preview.
  if (value === 'registration' && tournamentStatus !== 'registration') {
    viewRegistrationLogging.logClick()
    emit('viewRegistration')
    return
  }

  if (typeof value === 'string' && value.startsWith('round-')) {
    const round = parseInt(value.replace('round-', ''), 10)
    // Once ended, the last round (round === lastPlayableRound) is also
    // navigable — that's the "correct last round" entry point, not just past rounds.
    const isNavigable = round < lastPlayableRound.value || (round === lastPlayableRound.value && tournamentStatus === 'ended')
    if (isNavigable) {
      lastViewedRound.value = round
      viewRoundLogging.logClick()
      emit('viewRound', round)
      return
    }
  }

  // Any other click (registration while registering/ended/future round) isn't navigable — snap back.
  internalStep.value = displayStep.value
}

defineExpose({
  stepper,
  hasPrev: computed(() => stepper.value?.hasPrev ?? false),
  prev: () => stepper.value?.prev()
})
</script>

<template>
  <div class="w-full">
    <UStepper
      ref="stepper"
      v-model="internalStep"
      :items="items"
      class="w-full"
      :ui="{
        content: 'w-full',
        // Step nav (registration + every round + ended) scrolls horizontally
        // on narrow screens instead of squeezing every item's title/description
        // to fit the viewport — only the nav header, not the per-step content
        // below it. Left-aligned (no justify-center/max-w-2xl/mx-auto, removed
        // 2026-07-31 — centering a handful of shrink-0/w-auto items left large
        // empty gutters on both sides, inconsistent with the rest of the
        // page's full-width left-aligned layout) so items pack against the
        // header's own left edge, same as the breadcrumb/table above and below it.
        header: 'overflow-x-auto pb-1 justify-start',
        item: 'shrink-0 min-w-28 w-auto',
      }"
      @update:model-value="handleStepClick"
    >
      <template #content="{ item }">
        <slot name="content" :item="item" />
      </template>
    </UStepper>
  </div>
</template>
