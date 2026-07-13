# Todos

## Parametrization opportunities found during the i18n migration
Not urgent, just flagged while migrating strings on 2026-07-13:
- **Status→color/icon config duplicated per table.** `LeagueTable.vue`'s `statusConfig` and `EventTable.vue`'s equivalent both hardcode their own `Record<string, { color, icon, labelKey }>` mapping a stable status value to a badge color/icon/i18n key. Same shape, two copies. As of 2026-07-13, deliberately left unabstracted and formally suppressed via `// fallow-ignore-file code-duplication` in both files (see `app/components/ui/CLAUDE.md`) rather than left as silent noise in `fallow:dupes` output — still worth a shared composable (e.g. `useStatusBadge()`) if a third status-bearing entity shows up.
- **Date/number formatting isn't locale-aware.** `formatDate` and friends use hardcoded formatting rather than deriving from the active `vue-i18n` locale. Harmless while `it` is the only locale, but would need revisiting the moment a second locale is added.

## Migrate Italian strings into @nuxtjs/i18n — ✅ Done (2026-07-13)
Full migration completed and verified (lint/typecheck/test/fallow all clean). See `docs/PROGRESS.md` ADR-010 for the summary and the key `useI18n()` usage patterns/constraints discovered, and `CLAUDE.md`'s "Conventions worth knowing" section for the day-to-day patterns (translated prop defaults, Pinia store usage, async-callback constraints). All messages live in `i18n/locales/it.json`.

## Duplication elimination + health config tuning — ✅ Done (2026-07-13)
See `docs/PROGRESS.md` ADR-011. `fallow:dupes` went from 128 clone groups (17.6%) to 0. Component library reorganized under `app/components/ui/{actions,modal,layout,display,input}/`.

## Add Playwright + Playwright MCP
- Add `@playwright/test` and a `playwright.config.ts` for E2E tests (`docs/AGENTS.md` already calls for Playwright + `@nuxt/test-utils` E2E coverage on critical flows: event creation, round progression, score submission)
- `playwright-core` is a direct devDependency but currently unused (no config or tests) — exempted in `.fallowrc.json`'s `ignoreDependencies` for exactly this reason; remove the exemption once real E2E tests land
- Set up the Playwright MCP server for browser-driven E2E authoring/debugging

## Round timer alarm sound
`RoundTimer.vue` (and `TimerControlButton.vue`) are already implemented and working — this item is only about adding an audible/notification alarm when a round's timer expires, which isn't built yet:

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

Wire into `RoundTimer.vue`'s expiry check:

```ts
const { play: playAlarm } = useAlarmSound()

const { pause, resume } = useIntervalFn(() => {
  if (!startTime.value) return
  elapsed.value = Math.floor((Date.now() - startTime.value) / 1000)
  if (isExpired.value) {
    pause()
    playAlarm()
    emit('expired')
  }
}, 1000, { immediate: false })
```
