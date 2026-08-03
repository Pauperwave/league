// app\composables\tournament\useTournamentSubmitHandlers.ts

import type { Kill } from '#shared/utils/types'
import type { RankingEntry } from '~/stores/rankings'

interface SubmitHandlerDeps {
  rankingsStore: ReturnType<typeof import('~/stores/rankings').useRankingsStore>
  tournamentStore: ReturnType<typeof import('~/stores/tournaments').useTournamentStore>
  killsStore: ReturnType<typeof import('~/stores/kills').useKillsStore>
  commandersStore: ReturnType<typeof import('~/stores/commanders').useCommandersStore>
  votesStore: ReturnType<typeof import('~/stores/votes').useVotesStore>
  toast: ReturnType<typeof import('#ui/composables/useToast').useToast>
  selectedPairingId: Ref<number | null>
  selectedPlayerId: Ref<number | null>
  selectedCommanderPairingId: Ref<number | null>
  selectedVotesPlayerId: Ref<number | null>
  selectedVotesPairingId: Ref<number | null>
  refreshDisplayedPairings: () => Promise<unknown>
}

/**
 * Composable for all modal "submit" / "save" action handlers.
 */
export function useTournamentSubmitHandlers(deps: SubmitHandlerDeps) {
  const {
    rankingsStore, tournamentStore, commandersStore, votesStore, toast,
    selectedPairingId, selectedPlayerId, selectedCommanderPairingId,
    selectedVotesPlayerId, selectedVotesPairingId, refreshDisplayedPairings,
  } = deps

  const { t } = useI18n()
  const queryCache = useQueryCache()

  /** Shared by handleKillsSubmit and handleVotesSubmit — same success/error
   * toast shape, just a different success title. */
  function toastResult(successTitle: string, result: { success: boolean, error?: string }) {
    toast.add({
      title: result.success ? successTitle : t('deck.toast.errorTitle'),
      description: result.success ? undefined : result.error,
      color: result.success ? 'success' : 'error'
    })
  }

  /** Shared by handleScoreSubmit and handleDrawSubmit — sets the local
   * ranking state and persists it, with the same toast/error handling. */
  function saveRanking(pairingId: number, rankingWithRanks: RankingEntry[]) {
    rankingsStore.setRankingWithRanks(pairingId, rankingWithRanks)
    toast.add({ title: t('tournament.rankingsSavedTitle'), color: 'success' })
    tournamentStore.savePairingRankings(
      pairingId,
      rankingWithRanks.map(r => ({ playerId: r.playerId, position: r.rank }))
    )
      .then((result) => {
        if (!result.success) {
          toast.add({
            title: t('deck.toast.errorTitle'),
            description: result.error,
            color: 'error'
          })
          return
        }
        // Refetch so "Punteggi Tavolo" (TableScoresModal, reads
        // pairing.round_results directly rather than the session stores)
        // reflects the placement points immediately instead of the stale
        // pre-submit round_results snapshot.
        refreshDisplayedPairings()
      })
  }

  function handleScoreSubmit(ranking: number[], rankingWithRanks: RankingEntry[]) {
    if (selectedPairingId.value !== null) {
      saveRanking(selectedPairingId.value, rankingWithRanks)
    }
    return true // signal to caller that modal can close
  }

  function handleKillsSubmit(pairingId: number, kills: Kill[]) {
    tournamentStore.savePairingKills(pairingId, kills)
      .then(result => {
        toastResult(t('tournament.killsSavedTitle'), result)
        // Refetch so the "Uccisioni" button's reviewed indicator (derived
        // from round_results.number_of_kills, see PairingsCard) updates
        // immediately instead of waiting for the next lifecycle transition.
        if (result.success) refreshDisplayedPairings()
      })
  }

  /** "Patta" from the kill modal: no kills happened, and every seated player
   * ties for first — matches the ruleset's existing tied-rank scoring
   * (roundScoring.ts averages the placement values across tied positions). */
  function handleDrawSubmit(pairingId: number, playerIds: number[]) {
    handleKillsSubmit(pairingId, [])
    saveRanking(pairingId, playerIds.map(playerId => ({ playerId, rank: 1 })))
  }

  function handleCommanderSubmit(commander1: string | null, commander2: string | null) {
    if (selectedPlayerId.value !== null && selectedCommanderPairingId.value !== null) {
      commandersStore.setCommanders(selectedPlayerId.value, commander1, commander2)
      toast.add({
        title: t('tournament.commandersSavedTitle'),
        color: 'success'
      })
      tournamentStore.saveCommander(
        selectedCommanderPairingId.value,
        selectedPlayerId.value,
        commander1,
        commander2
      )
        .then(result => {
          if (!result.success) {
            toast.add({
              title: t('deck.toast.errorTitle'),
              description: result.error,
              color: 'error'
            })
            return
          }
          // useCommanderUsageQuery's cache is shared/prefetched per round
          // (2026-07-26 follow-up to ADR-027) — invalidate it so a commander
          // saved just now shows up in "già giocati" the next time any
          // player's modal opens, instead of waiting out staleTime.
          queryCache.invalidateQueries({ key: ['commander-usage'] })
        })
    }
    return true
  }

  function handleVotesSubmit(deckVotePlayerId: number | null, playVotePlayerId: number | null) {
    if (selectedVotesPlayerId.value !== null && selectedVotesPairingId.value !== null) {
      votesStore.setVotes(selectedVotesPlayerId.value, deckVotePlayerId, playVotePlayerId)
      tournamentStore.saveVote(
        selectedVotesPairingId.value,
        selectedVotesPlayerId.value,
        deckVotePlayerId,
        playVotePlayerId
      )
        .then((result) => {
          toastResult(t('tournament.voteSavedTitle'), result)
          // Same reason as saveRanking: "Punteggi Tavolo" reads round_results
          // directly (deck/play point columns), so it needs a refetch to
          // pick up the vote just saved.
          if (result.success) refreshDisplayedPairings()
        })
    }
    return true
  }

  return {
    handleScoreSubmit,
    handleKillsSubmit,
    handleDrawSubmit,
    handleCommanderSubmit,
    handleVotesSubmit,
  }
}
