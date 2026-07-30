<!-- app\components\tournament\RoundTimer.vue -->
<script setup lang="ts">
/**
 * RoundTimer
 *
 * A 3-phase countdown sequence for a single tournament round:
 * 1. "pre" — fixed 3-minute setup countdown.
 * 2. "round" — the configured round duration (+ any added/removed bonus minutes).
 * 3. "turns" — a fixed 15-minute "TURNI" (extra turns) countdown.
 * Once "turns" expires, the display switches to a terminal "FINE PARTITA" state.
 * Each phase auto-starts the next when it expires — a single Avvia click
 * drives the whole sequence.
 *
 * - Persists phase + start timestamp to localStorage keyed by round number,
 *   so a page refresh resumes exactly where it left off — including
 *   cascading through any phases that fully elapsed while the page was
 *   closed (e.g. laptop asleep through the whole round + turns).
 * - Supports pause/resume, reset, and fullscreen mode.
 * - Emits `expired` once, when the "round" phase ends (turns begins) —
 *   same meaning as before this component grew the extra phases.
 * - Every phase's start/end is recorded in the developer-mode action log
 *   (useActionLog) directly, since these are automatic transitions, not
 *   button clicks — see logPhase().
 */

const PRE_TIMER_MINUTES = 3
const TURNS_TIMER_MINUTES = 15

type Phase = 'pre' | 'round' | 'turns' | 'ended'

const props = defineProps<{
  /** Total countdown duration in minutes for the "round" phase. */
  durationMinutes: number
  /** Round number — used to key the localStorage entry so each round has its own timer. */
  round: number
}>()

const emit = defineEmits<{
  /** Fired once when the "round" phase ends and "turni" begins. */
  expired: []
}>()

const { t } = useI18n()
const { play, playLoop, stopLoop } = useSoundEffects()
const { recordEntry } = useActionLog()

// Once the final phase expires, keep the alarm repeating until any key is
// pressed — a single "complete" chime is easy to miss when nobody's
// looking at the screen at the exact moment the timer hits zero.
useEventListener(window, 'keydown', stopLoop)

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Which of the 3 phases (or the terminal "ended" state) is currently active. */
const phase = useLocalStorage<Phase>(`round-timer-phase-${props.round}`, 'pre')

/**
 * The Unix timestamp (ms) at which the *current phase* was last started or
 * resumed. Persisted to localStorage so a page refresh can restore the
 * running state. Null when nothing has been started yet, or the sequence
 * has reached "ended".
 */
const startTime = useLocalStorage<number | null>(`round-timer-start-${props.round}`, null)

/** Seconds elapsed in the current phase, accounting for pauses. */
const elapsed = ref(0)

/** Whether the interval is currently ticking. */
const isRunning = ref(false)

/** Extra minutes added to the "round" phase only (e.g. time extensions). */
const timeBonus = useLocalStorage<number>(`round-timer-bonus-${props.round}`, 0)

// ---------------------------------------------------------------------------
// Logging (automatic phase transitions, not button clicks — see useActionLog)
// ---------------------------------------------------------------------------

function logPhase(key: 'preStart' | 'preEnd' | 'roundStart' | 'roundEnd' | 'turnsStart' | 'turnsEnd') {
  recordEntry({ button: t(`logging.timer.${key}`), timestamp: new Date().toISOString(), context: { round: props.round } })
}

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

/** This phase's total duration in minutes (fixed for pre/turns, configurable + bonus for round). */
const phaseDurationMinutes = computed(() => {
  if (phase.value === 'pre') return PRE_TIMER_MINUTES
  if (phase.value === 'turns') return TURNS_TIMER_MINUTES
  if (phase.value === 'round') return props.durationMinutes
  return 0
})

/** Bonus minutes only apply to the "round" phase. */
const phaseBonusMinutes = computed(() => phase.value === 'round' ? timeBonus.value : 0)

/** Total duration in seconds for the current phase (base + any added time). */
const totalSeconds = computed(() => calculateTotalSeconds(phaseDurationMinutes.value, phaseBonusMinutes.value))

/** Seconds remaining, clamped to [0, totalSeconds]. */
const remaining = computed(() => calculateRemainingSeconds(totalSeconds.value, elapsed.value))

/** True once the current phase's countdown hits zero (never true once "ended"). */
const isExpired = computed(() => phase.value !== 'ended' && isTimerExpired(remaining.value))

/** True once the timer has been started at least once and is currently paused (not fresh, not expired, not ended). */
const isPaused = computed(() => phase.value !== 'ended' && isTimerPaused(isRunning.value, startTime.value !== null, isExpired.value))

/** Human-readable MM:SS string for the remaining time in the current phase. */
const display = computed(() => formatDuration(remaining.value))

/** Phase label shown to the right of the timer icon (one per phase, including the terminal "ended" state). */
const phaseLabel = computed(() => t(`tournament.roundTimer.phases.${phase.value}`))

/** Phase label color — matches the phase's urgency (yellow for get-ready/turns, green for active play, red for game over). */
const phaseLabelColorClass = computed(() => {
  if (phase.value === 'round') return 'text-success'
  if (phase.value === 'ended') return 'text-error'
  return 'text-warning'
})

// ---------------------------------------------------------------------------
// Fullscreen
// ---------------------------------------------------------------------------

const timerRef = useTemplateRef<HTMLDivElement>('timerRef')
const { isFullscreen, toggle } = useFullscreen(timerRef)

// Watched (not click-handler-wrapped) so Escape-key exits get the same
// "collapse" feedback as clicking the exit button.
watch(isFullscreen, (value) => {
  play(value ? 'expand' : 'collapse')
})

const toggleFullscreenLogging = useButtonLogging(t('logging.timer.toggleFullscreen'), {
  round: () => props.round,
  isFullscreen: () => isFullscreen.value,
})

function handleToggleFullscreen() {
  toggleFullscreenLogging.logClick()
  toggle()
}

// ---------------------------------------------------------------------------
// Reset confirmation
// ---------------------------------------------------------------------------
// Resetting wipes elapsed time AND any added/removed minutes, and restarts
// the whole pre/round/turni sequence from "pre" — destructive enough (and
// easy to fat-finger, especially on the oversized fullscreen buttons) to
// gate behind a confirmation, same as PairingsCard.vue's table reset. One
// modal instance covers both the normal and fullscreen layouts, since this
// component renders both from the same template.
const showResetConfirm = ref(false)

// ---------------------------------------------------------------------------
// Subtract-to-zero confirmation
// ---------------------------------------------------------------------------
// Subtracting minutes is otherwise unconfirmed (reversible via Add, unlike
// Reset) — but a subtraction that would *immediately* expire the round is
// the one consequential case, so it gets a lighter, warning-colored confirm
// rather than Reset's heavier error-colored one.
const showSubtractExpireConfirm = ref(false)
const pendingSubtractMinutes = ref(0)

// ---------------------------------------------------------------------------
// Phase transitions
// ---------------------------------------------------------------------------

/**
 * Advances through phase boundaries as long as the current phase's elapsed
 * time has caught up to (or overtaken) its duration — a plain `if` would
 * only handle one boundary per tick, but a page that was closed through an
 * entire phase (or more) needs to cascade through all of them at once, each
 * carrying its overflow into the next phase's elapsed time so the next
 * phase's remaining time is still accurate. Called from both the live tick
 * and onMounted's catch-up, so a long absence behaves identically to being
 * watched live.
 */
function advancePastExpiry() {
  while (phase.value !== 'ended' && elapsed.value >= totalSeconds.value) {
    const overflow = elapsed.value - totalSeconds.value

    if (phase.value === 'pre') {
      logPhase('preEnd')
      play('notification')
      phase.value = 'round'
      logPhase('roundStart')
    } else if (phase.value === 'round') {
      logPhase('roundEnd')
      play('warning')
      emit('expired')
      phase.value = 'turns'
      logPhase('turnsStart')
    } else {
      logPhase('turnsEnd')
      phase.value = 'ended'
      startTime.value = null
      elapsed.value = 0
      isRunning.value = false
      playLoop('warning')
      return
    }

    startTime.value = Date.now() - overflow * 1000
    elapsed.value = overflow
  }
}

// ---------------------------------------------------------------------------
// Interval
// ---------------------------------------------------------------------------

const { pause, resume } = useIntervalFn(() => {
  // startTime is set back to null when "ended" is reached (see
  // advancePastExpiry), so this alone also skips ticks after the sequence
  // is over — no separate `phase.value === 'ended'` check needed here.
  if (!startTime.value) return

  elapsed.value = Math.floor((Date.now() - startTime.value) / 1000)

  if (elapsed.value >= totalSeconds.value) {
    advancePastExpiry()
    if (phase.value === 'ended') pause()
  }
}, 1000, { immediate: false })

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

const startLogging = useButtonLogging(t('logging.timer.start'), { round: () => props.round })
const stopLogging = useButtonLogging(t('logging.timer.pause'), { round: () => props.round })

/**
 * Start or resume the timer.
 * Back-calculates the effective start time from the current elapsed value
 * so that paused time is correctly excluded. Logs "preStart" only on the
 * very first-ever click for this round (phase "pre", nothing elapsed yet) —
 * every later click is just a resume from pause, not a new phase.
 */
function start() {
  startLogging.logClick()
  const isFreshStart = phase.value === 'pre' && elapsed.value === 0
  startTime.value = calculateResumeStartTime(Date.now(), elapsed.value)
  isRunning.value = true
  resume()
  play('play')
  if (isFreshStart) logPhase('preStart')
}

/** Pause the timer, preserving elapsed time for a later resume. */
function stop() {
  stopLogging.logClick()
  pause()
  isRunning.value = false
  play('pause')
}

const resetLogging = useButtonLogging(t('logging.timer.reset'), { round: () => props.round })

/** Stop the timer and reset the whole pre/round/turni sequence back to "pre". */
function reset() {
  resetLogging.logClick()
  pause()
  phase.value = 'pre'
  startTime.value = null
  elapsed.value = 0
  isRunning.value = false
  timeBonus.value = 0
  stopLoop()
  play('undo')
}

/**
 * ConfirmModal's own @confirm doesn't close itself (see ConfirmModal.vue —
 * only its cancel/dismiss paths do) — the caller is expected to close it.
 */
function confirmReset() {
  reset()
  showResetConfirm.value = false
}

/** Tracks the minutes argument of the last addMinutes/subtractMinutes call, for logging context. */
const lastMinutesDelta = ref(0)

const addMinutesLogging = useButtonLogging(t('logging.timer.addMinutes'), { round: () => props.round, minutes: () => lastMinutesDelta.value })
const subtractMinutesLogging = useButtonLogging(t('logging.timer.subtractMinutes'), { round: () => props.round, minutes: () => lastMinutesDelta.value })

/** Add extra minutes to the "round" phase. If it had expired, restarts it from the added time. */
function addMinutes(minutes: number) {
  lastMinutesDelta.value = minutes
  addMinutesLogging.logClick()
  const wasExpired = isExpired.value
  timeBonus.value += minutes
  if (wasExpired) {
    elapsed.value = 0
    startTime.value = null
    isRunning.value = false
    stopLoop()
  }
  play('select')
}

/** Remove minutes from the "round" phase, floored so its total duration never goes below zero. */
function subtractMinutes(minutes: number) {
  lastMinutesDelta.value = minutes
  subtractMinutesLogging.logClick()
  timeBonus.value = clampSubtractedBonus(timeBonus.value, minutes, props.durationMinutes)
  play('deselect')
}

/** Subtract, gated behind a confirm only when it would immediately expire the round. */
function onSubtractClick(minutes: number) {
  if (wouldSubtractExpireTimer(elapsed.value, timeBonus.value, minutes, props.durationMinutes)) {
    pendingSubtractMinutes.value = minutes
    showSubtractExpireConfirm.value = true
    return
  }
  subtractMinutes(minutes)
}

function confirmSubtractExpire() {
  subtractMinutes(pendingSubtractMinutes.value)
  showSubtractExpireConfirm.value = false
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * On mount, check whether a persisted start time exists from a previous
 * page load. Computes raw elapsed time for the current phase, then cascades
 * through any phase boundaries that were crossed while the page was closed
 * (advancePastExpiry), so a long absence lands on the correct phase with
 * the correct remaining time instead of just clamping to "expired".
 */
onMounted(() => {
  if (!startTime.value) return

  elapsed.value = Math.floor((Date.now() - startTime.value) / 1000)
  advancePastExpiry()

  if (phase.value !== 'ended') {
    isRunning.value = true
    resume()
  }
})
</script>

<template>
  <div
    ref="timerRef"
    class="flex items-center flex-wrap"
    :class="isFullscreen
      ? ['relative flex-col justify-center h-screen w-screen gap-12 @container-size', phase === 'ended' ? 'bg-error/10' : isPaused ? 'bg-warning/10' : 'bg-default']
      : phase === 'ended'
        ? 'gap-3 border border-error bg-error/10 rounded-lg px-4 py-2'
        : isPaused
          ? 'gap-3 border border-warning bg-warning/10 rounded-lg px-4 py-2'
          : 'gap-3 border border-default rounded-lg px-4 py-2'
    "
  >
    <CurrentTime
      v-if="isFullscreen"
      class="absolute top-[4cqmin] left-[4cqmin] text-muted"
    />

    <UTooltip v-if="isFullscreen" :content="{ side: 'top' }" :text="t('tournament.roundTimer.exitFullscreenTooltip')">
      <UButton
        :icon="ICONS.collapse"
        color="neutral"
        variant="ghost"
        size="xl"
        class="absolute top-[4cqmin] right-[4cqmin]"
        :aria-label="t('tournament.roundTimer.exitFullscreenTooltip')"
        @click="handleToggleFullscreen"
      />
    </UTooltip>

    <UIcon
      :name="ICONS.timer"
      :class="[
        isExpired ? 'text-error' : isRunning ? 'text-primary' : 'text-muted',
        isFullscreen ? 'size-[20cqmin]' : 'size-5',
      ]"
    />

    <!-- Phase label — always to the right of the icon, one per phase. -->
    <span
      class="font-bold uppercase tracking-wide"
      :class="[phaseLabelColorClass, isFullscreen ? 'text-[10cqmin]' : 'text-sm']"
    >
      {{ phaseLabel }}
    </span>

    <!-- Countdown display — nothing left to count once "ended". -->
    <span
      v-if="phase !== 'ended'"
      class="font-mono font-bold tabular-nums leading-none"
      :class="[
        isExpired ? 'text-error' : 'text-default',
        isFullscreen ? 'text-[32cqmin]' : 'text-2xl',
      ]"
    >
      {{ display }}
    </span>

    <!-- Controls — two groups that wrap independently onto their own line
         only when there isn't enough horizontal room for both, instead of
         always stacking or letting individual buttons wrap raggedly. -->
    <div
      class="flex"
      :class="isFullscreen ? 'flex-row gap-8' : 'flex-wrap gap-2'"
    >
      <div class="flex items-center" :class="isFullscreen ? 'flex-row gap-8' : 'gap-1'">
        <template v-if="phase !== 'ended'">
          <TimerControlButton
            v-if="!isRunning"
            :icon="ICONS.play"
            color="primary"
            variant="soft"
            :disabled="isExpired"
            :fullscreen="isFullscreen"
            :tooltip="isExpired ? t('tournament.roundTimer.expiredTooltip') : t('tournament.roundTimer.startTooltip')"
            @click="start"
          />
          <TimerControlButton
            v-else
            :icon="ICONS.pause"
            color="neutral"
            variant="soft"
            :fullscreen="isFullscreen"
            :tooltip="t('tournament.roundTimer.pauseTooltip')"
            @click="stop"
          />
        </template>

        <TimerControlButton
          :icon="ICONS.reset"
          color="error"
          variant="subtle"
          :fullscreen="isFullscreen"
          :tooltip="t('tournament.roundTimer.resetTooltip')"
          @click="showResetConfirm = true"
        />

        <TimerControlButton
          v-if="!isFullscreen"
          :icon="ICONS.expand"
          color="neutral"
          variant="ghost"
          :fullscreen="isFullscreen"
          :tooltip="t('tournament.roundTimer.fullscreenTooltip')"
          @click="handleToggleFullscreen"
        />
      </div>

      <div v-if="phase === 'round'" class="flex items-center" :class="isFullscreen ? 'flex-row gap-8' : 'gap-1'">
        <TimerControlButton
          :icon="ICONS.subtract"
          color="error"
          variant="outline"
          :fullscreen="isFullscreen"
          :tooltip="t('tournament.roundTimer.subtract10Tooltip')"
          label="10:00"
          @click="onSubtractClick(10)"
        />

        <TimerControlButton
          :icon="ICONS.subtract"
          color="error"
          variant="outline"
          :fullscreen="isFullscreen"
          :tooltip="t('tournament.roundTimer.subtract5Tooltip')"
          label="5:00"
          @click="onSubtractClick(5)"
        />

        <TimerControlButton
          :icon="ICONS.add"
          color="success"
          variant="outline"
          :fullscreen="isFullscreen"
          :tooltip="t('tournament.roundTimer.add5Tooltip')"
          label="5:00"
          @click="addMinutes(5)"
        />

        <TimerControlButton
          :icon="ICONS.add"
          color="success"
          variant="outline"
          :fullscreen="isFullscreen"
          :tooltip="t('tournament.roundTimer.add10Tooltip')"
          label="10:00"
          @click="addMinutes(10)"
        />
      </div>
    </div>

    <ConfirmModal
      v-model:open="showResetConfirm"
      :title="t('tournament.roundTimer.resetConfirm.title')"
      :description="t('tournament.roundTimer.resetConfirm.description')"
      :question="t('tournament.roundTimer.resetConfirm.question')"
      :confirm-label="t('tournament.roundTimer.resetConfirm.confirmLabel')"
      :confirm-icon="ICONS.reset"
      :portal="!isFullscreen"
      @confirm="confirmReset"
    />

    <ConfirmModal
      v-model:open="showSubtractExpireConfirm"
      :title="t('tournament.roundTimer.subtractExpireConfirm.title')"
      :description="t('tournament.roundTimer.subtractExpireConfirm.description')"
      :question="t('tournament.roundTimer.subtractExpireConfirm.question')"
      :confirm-label="t('tournament.roundTimer.subtractExpireConfirm.confirmLabel')"
      :confirm-icon="ICONS.subtract"
      confirm-color="warning"
      :portal="!isFullscreen"
      @confirm="confirmSubtractExpire"
    />
  </div>
</template>
