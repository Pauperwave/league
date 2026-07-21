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

/** True once the timer has been started at least once and is currently paused (not fresh, not expired). */
const isPaused = computed(() => !isRunning.value && startTime.value !== null && !isExpired.value)

/** Human-readable MM:SS string for the remaining time. */
const display = computed(() => formatDuration(remaining.value))

// ---------------------------------------------------------------------------
// Fullscreen
// ---------------------------------------------------------------------------

const timerRef = useTemplateRef<HTMLDivElement>('timerRef')
const { isFullscreen, toggle } = useFullscreen(timerRef)

// ---------------------------------------------------------------------------
// Reset confirmation
// ---------------------------------------------------------------------------
// Resetting wipes elapsed time AND any added/removed minutes — destructive
// enough (and easy to fat-finger, especially on the oversized fullscreen
// buttons) to gate behind a confirmation, same as PairingsCard.vue's table
// reset. One modal instance covers both the normal and fullscreen layouts,
// since this component renders both from the same template.
const showResetConfirm = ref(false)

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

/**
 * ConfirmModal's own @confirm doesn't close itself (see ConfirmModal.vue —
 * only its cancel/dismiss paths do) — the caller is expected to close it.
 */
function confirmReset() {
  reset()
  showResetConfirm.value = false
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

/** Remove minutes from the current round, floored so the total duration never goes below zero. */
function subtractMinutes(minutes: number) {
  timeBonus.value = Math.max(timeBonus.value - minutes, -props.durationMinutes)
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
      ? 'relative flex-col justify-center h-screen w-screen bg-default gap-12 @container-size'
      : isPaused
        ? 'gap-3 border border-warning bg-warning/10 rounded-lg px-4 py-2'
        : 'gap-3 border border-default rounded-lg px-4 py-2'
    "
  >
    <CurrentTime
      v-if="isFullscreen"
      class="absolute top-[4cqmin] left-[4cqmin] text-muted"
    />

    <UTooltip v-if="isFullscreen" :content="{ side: 'top' }" :text="t('event.roundTimer.exitFullscreenTooltip')">
      <UButton
        :icon="ICONS.collapse"
        color="neutral"
        variant="ghost"
        size="xl"
        class="absolute top-[4cqmin] right-[4cqmin]"
        :aria-label="t('event.roundTimer.exitFullscreenTooltip')"
        @click="toggle"
      />
    </UTooltip>

    <UIcon
      :name="ICONS.timer"
      :class="[
        isExpired ? 'text-error' : isRunning ? 'text-primary' : 'text-muted',
        isFullscreen ? 'size-[20cqmin]' : 'size-5',
      ]"
    />

    <!-- Countdown display -->
    <span
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
          color="error"
          variant="subtle"
          :fullscreen="isFullscreen"
          :tooltip="t('event.roundTimer.resetTooltip')"
          @click="showResetConfirm = true"
        />

        <TimerControlButton
          v-if="!isFullscreen"
          :icon="ICONS.expand"
          color="neutral"
          variant="ghost"
          :fullscreen="isFullscreen"
          :tooltip="t('event.roundTimer.fullscreenTooltip')"
          @click="toggle"
        />
      </div>

      <div class="flex items-center" :class="isFullscreen ? 'flex-row gap-8' : 'gap-1'">
        <TimerControlButton
          :icon="ICONS.subtract"
          color="error"
          variant="outline"
          :fullscreen="isFullscreen"
          :tooltip="t('event.roundTimer.subtract10Tooltip')"
          label="10:00"
          @click="subtractMinutes(10)"
        />

        <TimerControlButton
          :icon="ICONS.subtract"
          color="error"
          variant="outline"
          :fullscreen="isFullscreen"
          :tooltip="t('event.roundTimer.subtract5Tooltip')"
          label="5:00"
          @click="subtractMinutes(5)"
        />

        <TimerControlButton
          :icon="ICONS.add"
          color="success"
          variant="outline"
          :fullscreen="isFullscreen"
          :tooltip="t('event.roundTimer.add5Tooltip')"
          label="5:00"
          @click="addMinutes(5)"
        />

        <TimerControlButton
          :icon="ICONS.add"
          color="success"
          variant="outline"
          :fullscreen="isFullscreen"
          :tooltip="t('event.roundTimer.add10Tooltip')"
          label="10:00"
          @click="addMinutes(10)"
        />
      </div>
    </div>

    <ConfirmModal
      v-model:open="showResetConfirm"
      :title="t('event.roundTimer.resetConfirm.title')"
      :description="t('event.roundTimer.resetConfirm.description')"
      :question="t('event.roundTimer.resetConfirm.question')"
      :confirm-label="t('event.roundTimer.resetConfirm.confirmLabel')"
      :confirm-icon="ICONS.reset"
      :portal="!isFullscreen"
      @confirm="confirmReset"
    />
  </div>
</template>
