<!-- app/components/Events/RoundTimer.vue -->
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

/** Shared size for all control buttons — scales up in fullscreen. */
const btnSize = computed(() => isFullscreen.value ? 'xl' : 'md' as const)

/** Extra padding/font size applied to buttons in fullscreen mode. */
const btnClass = computed(() => isFullscreen.value ? 'p-8 text-4xl' : '')

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
      name="i-lucide-timer"
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
      <!-- Play (shown when paused/idle and not expired) -->
      <template v-if="!isRunning">
        <UTooltip v-if="!isFullscreen" :content="{ side: 'top' }" :text="isExpired ? 'Timer scaduto' : 'Avvia timer'">
          <UButton
            icon="i-lucide-play"
            color="primary"
            variant="soft"
            :disabled="isExpired"
            :size="btnSize"
            :class="btnClass"
            @click="start"
          />
        </UTooltip>
        <UButton
          v-else
          icon="i-lucide-play"
          color="primary"
          variant="soft"
          :disabled="isExpired"
          :size="btnSize"
          :class="btnClass"
          :title="isExpired ? 'Timer scaduto' : 'Avvia timer'"
          @click="start"
        />
      </template>

      <!-- Pause (shown while running) -->
      <template v-else>
        <UTooltip v-if="!isFullscreen" :content="{ side: 'top' }" text="Pausa timer">
          <UButton
            icon="i-lucide-pause"
            color="neutral"
            variant="soft"
            :size="btnSize"
            :class="btnClass"
            @click="stop"
          />
        </UTooltip>
        <UButton
          v-else
          icon="i-lucide-pause"
          color="neutral"
          variant="soft"
          :size="btnSize"
          :class="btnClass"
          title="Pausa timer"
          @click="stop"
        />
      </template>

      <!-- Reset -->
      <UTooltip v-if="!isFullscreen" :content="{ side: 'top' }" text="Resetta timer">
        <UButton
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="ghost"
          :size="btnSize"
          :class="btnClass"
          @click="reset"
        />
      </UTooltip>
      <UButton
        v-else
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        :size="btnSize"
        :class="btnClass"
        title="Resetta timer"
        @click="reset"
      />

      <!-- Add 5 minutes -->
      <UTooltip v-if="!isFullscreen" :content="{ side: 'top' }" text="Aggiungi 5 minuti">
        <UButton
          icon="i-lucide-plus"
          color="success"
          variant="soft"
          :size="btnSize"
          :class="btnClass"
          @click="addMinutes(5)"
        >
          <span :class="isFullscreen ? 'text-4xl' : ''">5:00</span>
        </UButton>
      </UTooltip>
      <UButton
        v-else
        icon="i-lucide-plus"
        color="success"
        variant="soft"
        :size="btnSize"
        :class="btnClass"
        title="Aggiungi 5 minuti"
        @click="addMinutes(5)"
      >
        <span class="text-4xl">5:00</span>
      </UButton>

      <!-- Add 10 minutes -->
      <UTooltip v-if="!isFullscreen" :content="{ side: 'top' }" text="Aggiungi 10 minuti">
        <UButton
          icon="i-lucide-plus"
          color="success"
          variant="soft"
          :size="btnSize"
          :class="btnClass"
          @click="addMinutes(10)"
        >
          <span :class="isFullscreen ? 'text-4xl' : ''">10:00</span>
        </UButton>
      </UTooltip>
      <UButton
        v-else
        icon="i-lucide-plus"
        color="success"
        variant="soft"
        :size="btnSize"
        :class="btnClass"
        title="Aggiungi 10 minuti"
        @click="addMinutes(10)"
      >
        <span class="text-4xl">10:00</span>
      </UButton>

      <!-- Fullscreen toggle -->
      <UTooltip v-if="!isFullscreen" :content="{ side: 'top' }" text="Schermo intero">
        <UButton
          icon="i-lucide-expand"
          color="neutral"
          variant="ghost"
          :size="btnSize"
          :class="btnClass"
          @click="toggle"
        />
      </UTooltip>
      <UButton
        v-else
        icon="i-lucide-shrink"
        color="neutral"
        variant="ghost"
        :size="btnSize"
        :class="btnClass"
        title="Esci da schermo intero"
        @click="toggle"
      />
    </div>
  </div>
</template>
