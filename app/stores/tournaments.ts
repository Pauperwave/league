// app\stores\tournaments.ts
// fallow-ignore-file code-duplication -- intentional store CRUD boilerplate, see app/stores/CLAUDE.md
import type { Tournament, Kill } from '#shared/utils/types'

/**
 * The tournament lifecycle state machine (ADR-015 carve-out): currentTournament plus
 * the BFF-backed lifecycle and round-result actions. All cache-like reads
 * (tournaments list, standings, pairings, pairing history) live in Colada queries
 * — useTournamentQueries.ts / useLeagueStandingsQuery.ts — which the callers
 * refresh/invalidate after lifecycle writes.
 */
export const useTournamentStore = defineStore('tournaments', () => {
  const { t } = useI18n()

  // ── State ──────────────────────────────────────────────────────────────────

  /** Currently selected tournament */
  const currentTournament = ref<Tournament | null>(null)
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

  /** Check if the current tournament has finished all rounds */
  const isTournamentEnded = computed(() => {
    if (!currentTournament.value) return false
    return (currentTournament.value.tournament_current_round ?? 0) > (currentTournament.value.tournament_round_number ?? 0)
  })

  // ── Actions: Tournament lifecycle ─────────────────────────────────────────────
  // Plain CRUD (create/update/delete) lives in useTournamentMutations (ADR-015) —
  // a Colada useMutation per action, invalidating ['events']/['league-standings']
  // automatically. What stays here is genuine multi-step orchestration.

  /**
   * Start a tournament via the BFF endpoint (ADR-013): the server owns the atomic
   * transition (validate waitroom + order → zeroed standings → flip to playing
   * → clear waitroom → round-1 pairings from the confirmed order).
   */
  async function startTournament(tournamentId: number, playerOrder?: number[]) {
    // Re-entrancy guard (BACKLOG #13): a double-click/retry while a previous
    // lifecycle action is still in flight is rejected here, not just
    // discouraged in the UI — `loading` already tracks any in-flight action.
    if (loading.value) {
      return { success: false as const, error: t('store.tournament.alreadyInProgressError') }
    }
    beginLoading()
    error.value = null

    try {
      const { event: updatedTournament } = await $fetch(`/api/events/${tournamentId}/start`, {
        method: 'POST',
        body: { playerOrder },
      })

      console.log('[useTournamentStore] start ok', { tournamentId })
      currentTournament.value = updatedTournament

      return { success: true as const, data: updatedTournament }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.tournament.startError'))
      console.error('[useTournamentStore] startTournament error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /**
   * Advance to the next round via the BFF endpoint (ADR-013): the server owns
   * the whole atomic transition (recompute standings from all rounds so far,
   * idempotently — ADR-020 — → advance or end the tournament → insert next
   * pairings from the confirmed playerOrder).
   * The pairing optimizer stays client-side (device-local preferences) — the
   * preview modal's confirmed order travels in the request body.
   */
  async function nextRound(tournamentId: number, currentRound: number, playerOrder?: number[]) {
    // Re-entrancy guard (BACKLOG #13) — see startTournament's comment.
    if (loading.value) {
      return { success: false as const, error: t('store.tournament.alreadyInProgressError') }
    }
    beginLoading()
    error.value = null

    try {
      const { event: updatedTournament, hasEnded } = await $fetch(`/api/events/${tournamentId}/advance-round`, {
        method: 'POST',
        body: { currentRound, playerOrder },
      })

      console.log('[useTournamentStore] advance-round ok', { tournamentId, newRound: updatedTournament.tournament_current_round, hasEnded })
      currentTournament.value = updatedTournament

      return { success: true as const }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.tournament.nextRoundError'))
      console.error('[useTournamentStore] nextRound error:', err)
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
  async function turnBackRound(tournamentId: number, currentRound: number) {
    // Re-entrancy guard (BACKLOG #13) — see startTournament's comment.
    if (loading.value) {
      return { success: false as const, error: t('store.tournament.alreadyInProgressError') }
    }
    beginLoading()
    error.value = null

    try {
      const { event: updatedTournament } = await $fetch(`/api/events/${tournamentId}/turn-back-round`, {
        method: 'POST',
        body: { currentRound },
      })

      console.log('[useTournamentStore] turn-back-round ok', { tournamentId, newRound: updatedTournament.tournament_current_round })
      currentTournament.value = updatedTournament

      return { success: true as const }
    }
    catch (err) {
      error.value = toErrorMessage(err, t('store.tournament.turnBackError'))
      console.error('[useTournamentStore] turnBackRound error:', err)
      return { success: false as const, error: error.value }
    }
    finally {
      endLoading()
    }
  }

  /** Set the currently selected tournament */
  function setCurrentTournament(tournament: Tournament | null) {
    currentTournament.value = tournament
  }

  // ── Actions: Round result submission ─────────────────────────────────────────

  /** Save player rankings (positions) for a pairing via the BFF endpoint (ADR-013) */
  async function savePairingRankings(pairingId: number, rankings: { playerId: number; position: number }[]): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/rankings`, { method: 'POST', body: { rankings } })
      console.log('[useTournamentStore] rankings saved', { pairingId, players: rankings.length })
      return { success: true }
    }
    catch (err) {
      console.error('[useTournamentStore] savePairingRankings error:', err)
      return { success: false, error: toErrorMessage(err, t('store.tournament.rankingsSaveError')) }
    }
  }

  /** Save a pairing's kill events (killer->victim pairs) via the BFF endpoint (ADR-013) */
  async function savePairingKills(pairingId: number, kills: Kill[]): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/kills`, { method: 'POST', body: { kills } })
      console.log('[useTournamentStore] kills saved', { pairingId, kills: kills.length })
      return { success: true }
    }
    catch (err) {
      console.error('[useTournamentStore] savePairingKills error:', err)
      return { success: false, error: toErrorMessage(err, t('store.tournament.killsSaveError')) }
    }
  }

  /** Undo a "Patta" declaration via the BFF endpoint (ADR-013) — clears
   * number_of_kills/position back to unset for every seated player. */
  async function undrawPairing(pairingId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/undraw`, { method: 'POST' })
      console.log('[useTournamentStore] draw undone', { pairingId })
      return { success: true }
    }
    catch (err) {
      console.error('[useTournamentStore] undrawPairing error:', err)
      return { success: false, error: toErrorMessage(err, t('store.tournament.undrawError')) }
    }
  }

  /** "Resetta tavolo" via the BFF endpoint (ADR-013) — clears every persisted
   * value for a pairing (kills, ranking/position, commander, votes), unlike
   * `undrawPairing` which deliberately leaves commander/votes untouched. */
  async function resetPairing(pairingId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/reset`, { method: 'POST' })
      console.log('[useTournamentStore] pairing reset', { pairingId })
      return { success: true }
    }
    catch (err) {
      console.error('[useTournamentStore] resetPairing error:', err)
      return { success: false, error: toErrorMessage(err, t('store.tournament.resetError')) }
    }
  }

  /** Save a player's commanders via the BFF endpoint (ADR-013) */
  async function saveCommander(pairingId: number, playerId: number, commander1: string | null, commander2: string | null = null): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/commander`, { method: 'POST', body: { playerId, commander1, commander2 } })
      console.log('[useTournamentStore] commander saved', { pairingId, playerId })
      return { success: true }
    }
    catch (err) {
      console.error('[useTournamentStore] saveCommander error:', err)
      return { success: false, error: toErrorMessage(err, t('store.tournament.commanderSaveError')) }
    }
  }

  /** Save a player's brew and play votes via the BFF endpoint (ADR-013) */
  async function saveVote(pairingId: number, playerId: number, brewVote: number | null, playVote: number | null): Promise<{ success: boolean; error?: string }> {
    try {
      await $fetch(`/api/pairings/${pairingId}/votes`, { method: 'POST', body: { playerId, brewVote, playVote } })
      console.log('[useTournamentStore] votes saved', { pairingId, playerId })
      return { success: true }
    }
    catch (err) {
      console.error('[useTournamentStore] saveVote error:', err)
      return { success: false, error: toErrorMessage(err, t('store.tournament.voteSaveError')) }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    // State
    currentTournament,
    loading,
    error,

    // Getters
    isTournamentEnded,

    // Actions — tournament lifecycle
    startTournament,
    nextRound,
    turnBackRound,
    setCurrentTournament,

    // Actions — round result submission
    saveVote,
    saveCommander,
    savePairingRankings,
    savePairingKills,
    undrawPairing,
    resetPairing,
  }
})
