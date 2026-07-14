<!-- app\components\event\RoundTimer.vue -->
<script setup lang="ts">
/**
 * RoundTimer
 *
 * A countdown timer for a single event round.
 *
 * - Persists the start timestamp to localStorage keyed by round number,
 *   so a page refresh resumes the timer exactly where it left off.
 * - Supports pause/resume, reset, and fullscreen mode.
 * - Emits `expired` once when the countdown reaches zero.
 */

const props = defineProps<{
  /** Total countdown duration in minutes. */
  durationMinutes: number
  /** Round number — used to key the localStorage entry so each round has its own timer. */
  round: number
}>()

const emit = defineEmits<{
  /** Fired once when the timer naturally reaches zero. */
  expired: []
}>()

const { t } = useI18n()

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * The Unix timestamp (ms) at which the timer was last started or resumed.
 * Persisted to localStorage so a page refresh can restore the running state.
 * Null when the timer has never been started or has been reset.
 */
const startTime = useLocalStorage<number | null>(`round-timer-start-${props.round}`, null)

/** Seconds elapsed since the timer was started, accounting for pauses. */
const elapsed = ref(0)

/** Whether the interval is currently ticking. */
const isRunning = ref(false)

/** Extra minutes added to the round duration (e.g. time extensions). */
const timeBonus = useLocalStorage<number>(`round-timer-bonus-${props.round}`, 0)

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

/** Total duration in seconds (base + any added time). */
const totalSeconds = computed(() => props.durationMinutes * 60 + timeBonus.value * 60)

/** Seconds remaining, clamped to [0, totalSeconds]. */
const remaining = computed(() => Math.max(0, totalSeconds.value - elapsed.value))

/** True once the countdown hits zero. */
const isExpired = computed(() => remaining.value === 0)

/** Human-readable MM:SS string for the remaining time. */
const display = computed(() => formatDuration(remaining.value))

// ---------------------------------------------------------------------------
// Fullscreen
// ---------------------------------------------------------------------------

const timerRef = useTemplateRef<HTMLDivElement>('timerRef')
const { isFullscreen, toggle } = useFullscreen(timerRef)

// ---------------------------------------------------------------------------
// Interval
// ---------------------------------------------------------------------------

const { pause, resume } = useIntervalFn(() => {
  if (!startTime.value) return

  elapsed.value = Math.floor((Date.now() - startTime.value) / 1000)

  if (isExpired.value) {
    pause()
    isRunning.value = false
    emit('expired')
  }
}, 1000, { immediate: false })

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/**
 * Start or resume the timer.
 * Back-calculates the effective start time from the current elapsed value
 * so that paused time is correctly excluded.
 */
function start() {
  startTime.value = Date.now() - elapsed.value * 1000
  isRunning.value = true
  resume()
}

/** Pause the timer, preserving elapsed time for a later resume. */
function stop() {
  pause()
  isRunning.value = false
}

/** Stop the timer and reset all state back to zero (including added time). */
function reset() {
  pause()
  startTime.value = null
  elapsed.value = 0
  isRunning.value = false
  timeBonus.value = 0
}

/** Add extra minutes to the current round. If the timer had expired, restarts it from the added time. */
function addMinutes(minutes: number) {
  const wasExpired = isExpired.value
  timeBonus.value += minutes
  if (wasExpired) {
    elapsed.value = 0
    startTime.value = null
    isRunning.value = false
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * On mount, check whether a persisted start time exists from a previous
 * page load. If the timer hadn't expired, resume it automatically.
 * If it had already expired, clamp elapsed to the total so the display
 * shows 00:00 cleanly and the expired state is consistent.
 */
onMounted(() => {
  if (!startTime.value) return

  elapsed.value = Math.floor((Date.now() - startTime.value) / 1000)

  if (!isExpired.value) {
    isRunning.value = true
    resume()
  } else {
    elapsed.value = totalSeconds.value
  }
})
</script>

<template>
  <div
    ref="timerRef"
    class="flex items-center"
    :class="isFullscreen
      ? 'relative flex-col justify-center h-screen w-screen bg-default gap-12 [container-type:size]'
      : 'gap-3'
    "
  >
    <CurrentTime
      v-if="isFullscreen"
      class="absolute top-[4cqmin] right-[4cqmin] text-muted"
    />
    <UIcon
      :name="ICONS.timer"
      :class="[
        isExpired ? 'text-error' : isRunning ? 'text-primary' : 'text-muted',
        isFullscreen ? 'size-[15cqmin]' : 'size-5',
      ]"
    />

    <!-- Countdown display -->
    <span
      class="font-mono font-bold tabular-nums leading-none"
      :class="[
        isExpired ? 'text-error' : 'text-default',
        isFullscreen ? 'text-[25cqmin]' : 'text-2xl',
      ]"
    >
      {{ display }}
    </span>

    <!-- Controls -->
    <div
      class="flex"
      :class="isFullscreen ? 'flex-row gap-8' : 'gap-1'"
    >
      <TimerControlButton
        v-if="!isRunning"
        :icon="ICONS.play"
        color="primary"
        variant="soft"
        :disabled="isExpired"
        :fullscreen="isFullscreen"
        :tooltip="isExpired ? t('event.roundTimer.expiredTooltip') : t('event.roundTimer.startTooltip')"
        @click="start"
      />
      <TimerControlButton
        v-else
        :icon="ICONS.pause"
        color="neutral"
        variant="soft"
        :fullscreen="isFullscreen"
        :tooltip="t('event.roundTimer.pauseTooltip')"
        @click="stop"
      />

      <TimerControlButton
        :icon="ICONS.reset"
        color="neutral"
        variant="ghost"
        :fullscreen="isFullscreen"
        :tooltip="t('event.roundTimer.resetTooltip')"
        @click="reset"
      />

      <TimerControlButton
        :icon="ICONS.add"
        color="success"
        variant="soft"
        :fullscreen="isFullscreen"
        :tooltip="t('event.roundTimer.add5Tooltip')"
        label="5:00"
        @click="addMinutes(5)"
      />

      <TimerControlButton
        :icon="ICONS.add"
        color="success"
        variant="soft"
        :fullscreen="isFullscreen"
        :tooltip="t('event.roundTimer.add10Tooltip')"
        label="10:00"
        @click="addMinutes(10)"
      />

      <TimerControlButton
        :icon="isFullscreen ? ICONS.collapse : ICONS.expand"
        color="neutral"
        variant="ghost"
        :fullscreen="isFullscreen"
        :tooltip="isFullscreen ? t('event.roundTimer.exitFullscreenTooltip') : t('event.roundTimer.fullscreenTooltip')"
        @click="toggle"
      />
    </div>
  </div>
</template>
