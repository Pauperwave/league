<!-- app\components\Events\RoundTimer.vue -->
<script setup lang="ts">
interface Props {
  durationMinutes: number
  round: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  expired: []
}>()

// Persist start time per round so a page refresh doesn't reset the timer
const startTime = useLocalStorage<number | null>(`round-timer-start-${props.round}`, null)

const elapsed = ref(0)
const isRunning = ref(false)

const remaining = computed(() => {
  const total = props.durationMinutes * 60
  return Math.max(0, total - elapsed.value)
})

const isExpired = computed(() => remaining.value === 0)

const display = computed(() => {
  const m = Math.floor(remaining.value / 60).toString().padStart(2, '0')
  const s = (remaining.value % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})

const { pause, resume } = useIntervalFn(() => {
  if (!startTime.value) return
  elapsed.value = Math.floor((Date.now() - startTime.value) / 1000)
  if (isExpired.value) {
    pause()
    emit('expired')
  }
}, 1000, { immediate: false })

function start() {
  startTime.value = Date.now() - elapsed.value * 1000
  isRunning.value = true
  resume()
}

function stop() {
  pause()
  isRunning.value = false
}

function reset() {
  pause()
  startTime.value = null
  elapsed.value = 0
  isRunning.value = false
}

// Resume from persisted start on mount
onMounted(() => {
  if (startTime.value) {
    elapsed.value = Math.floor((Date.now() - startTime.value) / 1000)
    if (!isExpired.value) {
      isRunning.value = true
      resume()
    }
  }
})
</script>

<template>
  <div class="flex items-center gap-3">
    <UIcon
      name="i-lucide-timer"
      class="size-5"
      :class="isExpired ? 'text-error' : isRunning ? 'text-primary' : 'text-muted'"
    />
    <span
      class="font-mono text-2xl font-bold tabular-nums"
      :class="isExpired ? 'text-error' : 'text-default'"
    >
      {{ display }}
    </span>
    <div class="flex gap-1">
      <UButton
        v-if="!isRunning"
        icon="i-lucide-play"
        size="sm"
        color="primary"
        variant="soft"
        :disabled="isExpired"
        @click="start"
      />
      <UButton
        v-else
        icon="i-lucide-pause"
        size="sm"
        color="neutral"
        variant="soft"
        @click="stop"
      />
      <UButton
        icon="i-lucide-rotate-ccw"
        size="sm"
        color="neutral"
        variant="ghost"
        @click="reset"
      />
    </div>
  </div>
</template>
