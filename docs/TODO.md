# Todos

## Centralize icon names
- 87+ unique `i-lucide-*` strings currently scattered as inline literals across `app/components`/`app/pages` — no single source of truth, easy to pick a different icon for the same concept in two places
- `app/app.config.ts` already exists (currently just `ui.colors`/`ui.button` theming) — Nuxt UI supports an `ui.icons` key there, but that only renames Nuxt UI's *internal* semantic slots (`close`, `chevronDown`, `loading`, …), not app-level icon choices
- For app-level icons (delete, edit, calendar, etc.), add a small constants module (e.g. `app/utils/icons.ts`, following the `app/utils/CLAUDE.md` inventory convention) exporting named icon constants, and migrate components to reference it instead of inline `i-lucide-*` strings
- Note: `ACTION_MAP` in `app/utils/actionButton.ts` already does this narrowly for the remove/edit/view action-button icons — same idea, needs to cover the rest

## Add @nuxtjs/i18n for Italian string centralization
- UI strings are hardcoded Italian literals throughout components (`docs/AGENTS.md`: "UI-facing strings: Italian") — no single source, hard to audit/change copy consistently
- Install: `npx nuxi@latest module add i18n`
- Even for a single-locale (Italian-only) app, `@nuxtjs/i18n` gives centralized string management (one `it.json`/`it.ts` locale file instead of literals scattered across every `.vue` file) — worth it purely for maintainability, not for actual multi-language support
- Nuxt UI has built-in locale support that should be wired up alongside it, in `app/app.vue` (root `<UApp>` already lives there):
  ```vue
  <script setup lang="ts">
  import { it } from '@nuxt/ui/locale'
  </script>

  <template>
    <UApp :locale="it">
      <NuxtPage />
    </UApp>
  </template>
  ```
- While in `app/app.vue`: `htmlAttrs.lang` is still `'en'` and the `useSeoMeta` title/description/OG image are unedited Nuxt UI starter-template boilerplate ("A production-ready starter template powered by Nuxt UI...", starter template screenshot as `ogImage`) — fix `lang` to `'it'` and write real app copy while touching this file for locale setup

## Add Playwright + Playwright MCP
- Add `@playwright/test` and a `playwright.config.ts` for E2E tests (`docs/AGENTS.md` already calls for Playwright + `@nuxt/test-utils` E2E coverage on critical flows: event creation, round progression, score submission)
- `playwright-core` is a direct devDependency but currently unused (no config or tests) — exempted in `.fallowrc.json`'s `ignoreDependencies` for exactly this reason; remove the exemption once real E2E tests land
- Set up the Playwright MCP server for browser-driven E2E authoring/debugging

## Stepper for Event Phases
- Implement `UStepper` component to track event phases (registration -> playing -> ended)
- See: https://ui.nuxt.com/raw/docs/components/stepper.md

## Round Timer
- Implement timer functionality for rounds using event's roundDuration field
- Add timer controls in event page when event is playing

## Stepper for Event Phases

Since the stepper is purely a visual status indicator (you don't want users clicking through steps), use disabled to lock navigation and drive the active step from your existing state:

```html
<!-- components/EventStepper.vue -->
<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'

interface Props {
  isPlaying: boolean
  isEventEnded: boolean
}

const props = defineProps<Props>()

const items: StepperItem[] = [
  { title: 'Registrazione', description: 'Iscrizioni aperte', icon: 'i-lucide-clipboard-list', value: 'registration' },
  { title: 'In Corso',      description: 'Round attivi',      icon: 'i-lucide-swords',         value: 'playing' },
  { title: 'Terminato',     description: 'Evento concluso',   icon: 'i-lucide-flag',           value: 'ended' },
]

const currentStep = computed(() => {
  if (props.isEventEnded) return 'ended'
  if (props.isPlaying)    return 'playing'
  return 'registration'
})
</script>

<template>
  <UStepper
    :items="items"
    :model-value="currentStep"
    disabled
    class="w-full"
  />
</template>
```

Then drop it into EventHeaderCard above the slot, or directly in the event page header.

## Round Timer

VueUse's useInterval + useLocalStorage (to survive page refreshes) is the right foundation:

```html
<!-- components/RoundTimer.vue -->
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
```

Usage in the event page's playing phase slot:

```html
<div v-else-if="isPlaying && !isEventEnded" class="flex flex-col gap-3">
  <RoundTimer
    :duration-minutes="currentEvent.event_round_duration"
    :round="currentRound"
    @expired="useToast().add({ title: 'Tempo scaduto!', color: 'warning', icon: 'i-lucide-alarm-clock' })"
  />
  <UButton color="primary" variant="soft" icon="i-lucide-arrow-right" @click="showNextRoundModal = true">
    Prossimo Round
  </UButton>
</div>
```
Key decisions worth noting:

useLocalStorage keyed by round — each round gets its own timer. When nextRound is called, the new round number means a fresh timer with no stale state from the previous round.
useIntervalFn from VueUse — auto-pauses when the component is unmounted, unlike a raw setInterval.
Elapsed-based rather than countdown-based — storing the start timestamp instead of decrementing a counter means a page refresh or tab switch can't desync the timer.

## add sound when the alarm turn off

```ts
// composables/useAlarmSound.ts
export function useAlarmSound() {
  const { show, isSupported } = useWebNotification({
    title: 'Tempo scaduto!',
    body: 'Il round è terminato.',
    icon: '/favicon.ico',
  })

  function play() {
    // Web Audio beeps (plays when tab is visible)
    const ctx = new AudioContext()
    const now = ctx.currentTime
    const beep = (t: number, freq: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.4, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.start(t)
      osc.stop(t + dur)
    }
    beep(now,       880, 0.3)
    beep(now + 0.4, 660, 0.3)
    beep(now + 0.8, 440, 0.6)

    // System notification (plays when tab is in background)
    if (isSupported.value) show()
  }

  return { play }
}
```

Then in RoundTimer.vue:

```ts
const { play: playAlarm } = useAlarmSound()

const { pause, resume } = useIntervalFn(() => {
  if (!startTime.value) return
  elapsed.value = Math.floor((Date.now() - startTime.value) / 1000)
  if (isExpired.value) {
    pause()
    playAlarm()       // 👈
    emit('expired')
  }
}, 1000, { immediate: false })
```

Should I do this?

ℹ Vite discovered new dependencies at runtime:                               08:22:48
  @internationalized/date ← ./app/composables/useTableUtils.ts

Pre-bundle them in your nuxt.config.ts to avoid page reloads:

```ts
export default defineNuxtConfig({
    vite: {
      optimizeDeps: {
        include: [
          '@internationalized/date',
        ]
      }
    }
})
```

Learn more: https://vite.dev/guide/dep-pre-bundling.html

Yes, do it. It's not strictly required but it's good practice — it tells Vite to pre-bundle @internationalized/date at startup instead of discovering it lazily at runtime, which eliminates the full-page reload you're seeing on first load.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    optimizeDeps: {
      include: [
        '@internationalized/date',
      ]
    }
  }
})
```

If you have other packages that trigger the same warning, add them to the same array rather than waiting for Vite to discover them one by one. Common ones in a Nuxt UI project are:

```ts
include: [
  '@internationalized/date',
  '@tanstack/vue-table',
  '@vueuse/core',
]
```
