// app\stores\events.ts
// fallow-ignore-file code-duplication -- intentional store CRUD boilerplate, see app/stores/CLAUDE.md
import type { Event } from '#shared/utils/types'

/**
 * The event lifecycle state machine (ADR-015 carve-out): currentEvent plus
 * the BFF-backed lifecycle and round-result actions. All cache-like reads
 * (events list, standings, pairings, pairing history) live in Colada queries
 * — useEventQueries.ts / useLeagueStandingsQuery.ts — which the callers
 * refresh/invalidate after lifecycle writes.
 */
export const useEventStore = defineStore('events', () => {
  const { t } = useI18n()

  // ── State ──────────────────────────────────────────────────────────────────

  /** Currently selected event */
  const currentEvent = ref<Event | null>(null)
  /** Counter for nested loading — stays true while ANY async action is in flight */
  const loadingCount = ref(0)
  /** Last error message */
  const error = ref<string | null>(null)

  // ── Derived loading state ──────────────────────────────────────────────────

  /** True while any async action is in flight */
  const loading = computed(() => loadingCount.value > 0)

  function beginLoading() { loadingCount.value++ }
  function endLoading() { loadingCount.value = Math.max(0, loadingCount.value - 1) }

  // ── Getters ────────────────────────────────────────────────────────────────

  /** Check if the current event has finished all rounds */
  const isEventEnded = computed(() => {
    if (!currentEvent.value) return false
    return (currentEvent.value.event_current_round ?? 0) > (currentEvent.value.event_round_number ?? 0)
  })

  // ── Actions: Event lifecycle ─────────────────────────────────────────────────
  // Plain CRUD (create/update/delete) lives in useEventMutations (ADR-015) —
  // a Colada useMutation per action, invalidating ['events']/['league-standings']
  // automatically. What stays here is genuine multi-step orchestration.

  /**
   * Start an event via the BFF endpoint (ADR-013): the server owns the atomic
   * transition (validate waitroom + order → zeroed standings → flip to playing
   * → clear waitroom → round-1 pairings from the confirmed order).
   */
  async function startEvent(eventId: number, playerOrder?: number[]) {
    // Re-entrancy guard (BACKLOG #13): a double-click/retry while a previous
    // lifecycle action is still in flight is rejected here, not just
    // discouraged in the UI — `loading` already tracks any in-flight action.
    if (loading.value) {
      return { success: false as const, error: t('store.event.alreadyInProgressError') }
    }
    beginLoading()
    error.value = null

    try {
      const { event: updatedEvent } = await $fetch(`/api/events/${eventId}/start`, {
        method: 'POST',
        body: { playerOrder },
      })

      console.log('[useEventStore] start ok', { eventId })
      currentEvent.value = updatedEvent

      return { success: true as const, data: updatedEvent }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.event.startError'))
      console.error('[useEventStore] startEvent error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /**
   * Advance to the next round via the BFF endpoint (ADR-013): the server owns
   * the whole atomic transition (score round → accumulate standings → advance
   * or end the event → insert next pairings from the confirmed playerOrder).
   * The pairing optimizer stays client-side (device-local preferences) — the
   * preview modal's confirmed order travels in the request body.
   */
  async function nextRound(eventId: number, currentRound: number, playerOrder?: number[]) {
    // Re-entrancy guard (BACKLOG #13) — see startEvent's comment.
    if (loading.value) {
      return { success: false as const, error: t('store.event.alreadyInProgressError') }
    }
    beginLoading()
    error.value = null

    try {
      const { event: updatedEvent, hasEnded } = await $fetch(`/api/events/${eventId}/advance-round`, {
        method: 'POST',
        body: { currentRound, playerOrder },
      })

      console.log('[useEventStore] advance-round ok', { eventId, newRound: updatedEvent.event_current_round, hasEnded })
      currentEvent.value = updatedEvent

      return { success: true as const }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.event.nextRoundError'))
      console.error('[useEventStore] nextRound error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /**
   * Go back to the previous round (or to registration from round 1) via the
   * BFF endpoint (ADR-013): the server owns the rollback, including the
   * waitroom restore when leaving round 1.
   */
  async function turnBackRound(eventId: number, currentRound: number) {
    // Re-entrancy guard (BACKLOG #13) — see startEvent's comment.
    if (loading.value) {
      return { success: false as const, error: t('store.event.alreadyInProgressError') }
    }
    beginLoading()
    error.value = null

    try {
      const { event: updatedEvent } = await $fetch(`/api/events/${eventId}/turn-back-round`, {
        method: 'POST',
        body: { currentRound },
      })

      console.log('[useEventStore] turn-back-round ok', { eventId, newRound: updatedEvent.event_current_round })
      currentEvent.value = updatedEvent

      return { success: true as const }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.event.turnBackError'))
      console.error('[useEventStore] turnBackRound error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /** Set the currently selected event */
  function setCurrentEvent(event: Event | null) {
    currentEvent.value = event
  }

  // ── Actions: Round result submission ─────────────────────────────────────────

  /** Save player rankings (positions) for a pairing via the BFF endpoint (ADR-013) */
  async function savePairingRankings(pairingId: number, rankings: { playerId: number; position: number }[]): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/rankings`, { method: 'POST', body: { rankings } })
      console.log('[useEventStore] rankings saved', { pairingId, players: rankings.length })
      return { success: true }
    }
    catch (err) {
      console.error('[useEventStore] savePairingRankings error:', err)
      return { success: false, error: toErrorMessage(err, t('store.event.rankingsSaveError')) }
    }
  }

  /** Save kill counts for a pairing via the BFF endpoint (ADR-013) */
  async function savePairingKills(pairingId: number, killCounts: { playerId: number; count: number }[]): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/kills`, { method: 'POST', body: { killCounts } })
      console.log('[useEventStore] kills saved', { pairingId, players: killCounts.length })
      return { success: true }
    }
    catch (err) {
      console.error('[useEventStore] savePairingKills error:', err)
      return { success: false, error: toErrorMessage(err, t('store.event.killsSaveError')) }
    }
  }

  /** Save a player's commanders via the BFF endpoint (ADR-013) */
  async function saveCommander(pairingId: number, playerId: number, commander1: string | null, commander2: string | null = null): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/commander`, { method: 'POST', body: { playerId, commander1, commander2 } })
      console.log('[useEventStore] commander saved', { pairingId, playerId })
      return { success: true }
    }
    catch (err) {
      console.error('[useEventStore] saveCommander error:', err)
      return { success: false, error: toErrorMessage(err, t('store.event.commanderSaveError')) }
    }
  }

  /** Save a player's brew and play votes via the BFF endpoint (ADR-013) */
  async function saveVote(pairingId: number, playerId: number, brewVote: number | null, playVote: number | null): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/votes`, { method: 'POST', body: { playerId, brewVote, playVote } })
      console.log('[useEventStore] votes saved', { pairingId, playerId })
      return { success: true }
    }
    catch (err) {
      console.error('[useEventStore] saveVote error:', err)
      return { success: false, error: toErrorMessage(err, t('store.event.voteSaveError')) }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    // State
    currentEvent,
    loading,
    error,

    // Getters
    isEventEnded,

    // Actions — event lifecycle
    startEvent,
    nextRound,
    turnBackRound,
    setCurrentEvent,

    // Actions — round result submission
    saveVote,
    saveCommander,
    savePairingRankings,
    savePairingKills,
  }
})
