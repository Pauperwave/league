// app\composables\ui\useSoundEffects.ts
import { createUISFX, type CueName, type PlayingSFX, type UISFXPlayer } from 'uisfx'

// Module-scope singleton: one AudioContext for the whole app, lazily created
// on first use (never on the server — Web Audio doesn't exist there, and
// creating an AudioContext before a user gesture is blocked by browsers
// anyway). Sounds are synthesized locally by uisfx, no audio-file fetches.
let player: UISFXPlayer | null = null

function getPlayer(): UISFXPlayer | null {
  if (!import.meta.client) return null
  player ??= createUISFX({ pack: 'minimal', volume: 0.5, preferences: { key: 'league:sound' } })
  return player
}

// Tracks the single currently-looping cue (e.g. the round-timer expiry
// alarm), so `stopLoop` can silence it even if called from an unrelated
// component instance.
let activeLoop: PlayingSFX | null = null

/** Semantic UI sound effects (uisfx). Call `play` directly from an event
 *  handler — every call also (re-)unlocks the AudioContext first, which is
 *  cheap/idempotent once already running, so callers don't need to sequence
 *  a separate unlock call themselves. */
export function useSoundEffects() {
  function play(cue: CueName) {
    const instance = getPlayer()
    if (!instance) return
    void instance.unlock().then(() => instance.play(cue))
  }

  /** Play `cue` on repeat until `stopLoop` is called. */
  function playLoop(cue: CueName) {
    const instance = getPlayer()
    if (!instance) return
    void instance.unlock().then(() => {
      activeLoop = instance.play(cue, { loop: true })
    })
  }

  /** Stop the cue started by `playLoop`, if any is still playing. */
  function stopLoop() {
    activeLoop?.stop()
    activeLoop = null
  }

  return { play, playLoop, stopLoop }
}
