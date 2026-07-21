// app\composables\event\useWaitingListFlags.ts

export interface WaitingListFlags {
  paid: boolean
  companion: boolean
}

function waitingListFlagsKey(eventId: number): string {
  return `waiting-list-flags-${eventId}`
}

// Effectively "until cleared" — a single event's registration phase never
// comes close to this long; the real invalidation is the explicit clear on
// event start (clearWaitingListFlags, called from useEventLifecycle.ts).
const FLAGS_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Per-event "pagato"/"companion" checkbox state for the waiting list —
 * ephemeral by design (confirmed 2026-07-14: "just for remembering right in
 * that moment", see docs/TODO.md), but persisted to localStorage so a page
 * refresh during registration doesn't silently reset every checkbox. Cleared
 * once the event actually starts (see useEventLifecycle.ts's
 * handlePreviewConfirm) since the waitroom itself is cleared then too.
 *
 * Deliberately NOT read synchronously at setup (unlike a plain
 * `useLocalStorage` ref) — SSR has no `localStorage` access, so a synchronous
 * read makes the server-rendered checkboxes (always empty) mismatch the
 * client's real persisted values at hydration time, which Nuxt UI's
 * `UCheckbox` doesn't reliably repaint (confirmed live: the value was
 * correctly hydrated internally, but the checkbox stayed visually unchecked
 * until an unrelated click forced a real re-render). Reading in `onMounted`
 * instead means SSR and the first client render produce an identical, empty
 * starting state, and the real values apply via a normal post-mount reactive
 * update — the same kind of update a user click already triggers correctly.
 */
export function useWaitingListFlags(eventId: number) {
  const flags = ref<Record<number, WaitingListFlags>>({})

  onMounted(() => {
    flags.value = getCached<Record<number, WaitingListFlags>>(waitingListFlagsKey(eventId), FLAGS_TTL_MS) ?? {}
  })

  watch(flags, (value) => {
    setCached(waitingListFlagsKey(eventId), value)
  }, { deep: true })

  return { flags }
}

export function clearWaitingListFlags(eventId: number) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(waitingListFlagsKey(eventId))
}
