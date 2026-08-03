// app\composables\tournament\useWaitingListFlags.ts
import type { PaymentMethod } from '#shared/utils/types'

export type { PaymentMethod }

export interface WaitingListFlags {
  paymentMethod: PaymentMethod | null
}

function waitingListFlagsKey(tournamentId: number): string {
  return `waiting-list-flags-${tournamentId}`
}

// Effectively "until cleared" — a single tournament's registration phase never
// comes close to this long; the real invalidation is the explicit clear on
// tournament start (clearWaitingListFlags, called from useTournamentLifecycle.ts).
const FLAGS_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Per-tournament payment state for the waiting list (POS / Contanti / not
 * paid) — ephemeral by design (confirmed 2026-07-14: "just for remembering
 * right in that moment", see docs/TODO.md; the payment-method selector that
 * replaced the plain "pagato" checkbox on 2026-07-31 kept the same ephemeral
 * contract), but persisted to localStorage so a page refresh during
 * registration doesn't silently reset every selection. Cleared once the
 * tournament actually starts (see useTournamentLifecycle.ts's
 * handlePreviewConfirm) since the waitroom itself is cleared then too.
 *
 * Deliberately NOT read synchronously at setup (unlike a plain
 * `useLocalStorage` ref) — SSR has no `localStorage` access, so a synchronous
 * read makes the server-rendered buttons (always unselected) mismatch the
 * client's real persisted values at hydration time, which Nuxt UI doesn't
 * reliably repaint (confirmed live on the old `UCheckbox` version: the value
 * was correctly hydrated internally, but stayed visually unchanged until an
 * unrelated click forced a real re-render). Reading in `onMounted` instead
 * means SSR and the first client render produce an identical, empty starting
 * state, and the real values apply via a normal post-mount reactive update —
 * the same kind of update a user click already triggers correctly.
 */
export function useWaitingListFlags(tournamentId: number) {
  const flags = ref<Record<number, WaitingListFlags>>({})

  onMounted(() => {
    flags.value = getCached<Record<number, WaitingListFlags>>(
      waitingListFlagsKey(tournamentId), FLAGS_TTL_MS
    ) ?? {}
  })

  watch(flags, (value) => {
    setCached(waitingListFlagsKey(tournamentId), value)
  }, { deep: true })

  return { flags }
}

export function clearWaitingListFlags(tournamentId: number) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(waitingListFlagsKey(tournamentId))
}

/**
 * One-off synchronous read for a click handler (e.g. `handlePreviewConfirm`
 * snapshotting payment methods before `startTournament` persists them and
 * `clearWaitingListFlags` wipes localStorage) — not reactive, so none of the
 * SSR-hydration concerns above apply; only ever called from a client-triggered action.
 */
export function readWaitingListFlags(tournamentId: number): Record<number, WaitingListFlags> {
  if (typeof window === 'undefined') return {}
  return getCached<Record<number, WaitingListFlags>>(
    waitingListFlagsKey(tournamentId), FLAGS_TTL_MS
  ) ?? {}
}
