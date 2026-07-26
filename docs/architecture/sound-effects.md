# Sound Effects (uisfx)

## Overview

Semantic UI sound effects, synthesized locally by [`uisfx`](https://uisfx.com) — no audio files are fetched over the network. Currently wired into `RoundTimer.vue` only (round start/pause/reset/add/subtract minutes, fullscreen toggle, and "time's up" on expiry).

**Core composable:** `app/composables/ui/useSoundEffects.ts`

---

## Why a singleton composable, not a store

Sound playback isn't reactive app state — no component needs to read "is a sound currently playing." It's a fire-and-forget side effect, so it doesn't fit the Pinia session-store shape (`app/stores/CLAUDE.md`: session stores hold ephemeral *reactive* UI state with a `reset()`). Instead, `useSoundEffects.ts` holds a module-scope `UISFXPlayer` singleton, lazily created on first use:

```ts
let player: UISFXPlayer | null = null

function getPlayer(): UISFXPlayer | null {
  if (!import.meta.client) return null
  player ??= createUISFX({ pack: 'minimal', volume: 0.5, preferences: { key: 'league:sound' } })
  return player
}
```

- **`import.meta.client` guard**: `AudioContext` doesn't exist during SSR, and browsers block creating one before a user gesture anyway — the singleton must never be constructed server-side.
- **One `AudioContext` for the whole app**: every call to `useSoundEffects()` returns fresh `{ play }` functions, but they all close over the same lazily-created player. Calling `useSoundEffects()` from multiple components is cheap and doesn't create duplicate audio contexts.
- **`preferences: { key: 'league:sound' }`**: persists pack/volume/enabled state to `localStorage` under this key (uisfx's own built-in persistence, not `app/utils/localStorage.ts`'s `getCached`/`setCached`).

## Unlock-on-every-play, not a separate unlock step

uisfx's own docs recommend calling `await ui.unlock()` once from the first trusted user gesture, then `ui.play(...)` afterward. Sequencing that separately would mean every consumer needs to remember to call `unlock()` first — easy to forget, and RoundTimer's buttons are exactly the kind of scattered call sites where that would happen. Instead, `play()` unlocks on every call:

```ts
function play(cue: CueName) {
  const instance = getPlayer()
  if (!instance) return
  void instance.unlock().then(() => instance.play(cue))
}
```

`unlock()` resolves immediately once the `AudioContext` is already running (idempotent), so this adds no meaningful overhead after the first call — callers just call `play(cue)` and never think about unlocking.

---

## Cue mapping (`RoundTimer.vue`)

| Action | Cue | Why |
|---|---|---|
| Start / resume | `play` | Exact semantic match (Media category: "Media playback begins or resumes") |
| Pause | `pause` | Exact match |
| Reset (after confirm) | `undo` | Reset reverses elapsed progress back to zero — closest fit to "most recent change is reversed" |
| Add minutes | `select` | No dedicated increment/decrement cue exists; `select`/`deselect` is the library's own opposite-pair, reused here for +/- |
| Subtract minutes | `deselect` | Opposite of `select`, fired from both `onSubtractClick`'s direct path and the subtract-to-zero confirm path (both funnel through `subtractMinutes()`) |
| Enter fullscreen | `expand` | Exact match ("A collapsed region reveals more detail") |
| Exit fullscreen | `collapse` | Exact match — **watched on `isFullscreen`**, not bound to the exit button's `@click`, so an Escape-key exit gets the same feedback as clicking the button |
| Round expires ("time's up") | `complete` | No dedicated alarm/timeout cue exists in the library; `complete` ("a multi-step process reaches its final state") fits a round timer's natural end better than `warning` or `error`, which read as failure states |

No cue exists for "increment/decrement a duration" or "countdown expired" specifically — uisfx's 78 cues are general-purpose UI semantics (media, editing, navigation, feedback, etc.), not domain-specific to tournament timers. The mappings above are the closest available fit, not a 1:1 semantic match in every case.

---

## Extending to other buttons

The pack (`minimal`), volume (`0.5`), and persistence key (`league:sound`) are fixed inside `getPlayer()` — any component calling `useSoundEffects()` shares the same configuration automatically. To add sounds elsewhere:

1. `const { play } = useSoundEffects()` in the component.
2. Call `play('cueName')` at the point the state actually changes (not just on click) — e.g. `RoundTimer.vue`'s `subtractMinutes()` plays regardless of which caller path triggered it, so the sound never fires on a button press that only opens a confirmation dialog without committing the action yet.
3. Check `node_modules/uisfx/dist/index.d.ts`'s `CUES` array (or [uisfx.com](https://uisfx.com)) for the full 78-cue list across 13 categories before picking one — reuse an existing semantic mapping (e.g. `success`/`error` for save outcomes, `delete`/`cancel`/`undo` for the modal-footer actions already documented in `app/components/ui/CLAUDE.md`) rather than inventing a new one-off pairing.
