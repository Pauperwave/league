// app\composables\event\useTableCompletion.ts
import type { Pairing, PairingWithResults } from '#shared/utils/types'
import { getPairingPlayerIds } from '#shared/utils/types'

/**
 * Per-pairing/per-player "is this done" predicates, shared between
 * `PairingsCard.vue` (table cards) and `RoundStatusCard.vue` (sidebar
 * summary) so both agree on the exact same definition of "complete" —
 * previously these lived only as local consts inside `PairingsCard.vue`.
 */
export function useTableCompletion(
  rankingsStore: ReturnType<typeof useRankingsStore>,
  commandersStore: ReturnType<typeof useCommandersStore>,
  votesStore: ReturnType<typeof useVotesStore>,
) {
  /**
   * Returns true once every seated player in `pairing` has a ranking entry —
   * shared with `buildStandingsSubmissionMap` (`standingsSubmission.ts`) via
   * `hasCompleteRanking` so the round-status sidebar and the standings
   * "Inserito" badge agree on what counts as a ranked table.
   */
  const hasRanking = (pairing: Pairing): boolean => {
    const ranking = rankingsStore.getRankingWithRanks(pairing.pairing_id) ?? []
    return hasCompleteRanking(getPairingPlayerIds(pairing), ranking.map(r => r.playerId))
  }

  /**
   * True once the kill modal has been confirmed at least once for this
   * pairing (even with zero kills) — read from `round_results.number_of_kills`,
   * which `kills.post.ts` only ever writes on a confirm, staying `null` until
   * then. Not from `killsStore` (the session store): it's a single flat array
   * shared across whichever pairing's modal is currently open, not scoped per
   * pairing, so it can't answer "has this *other* table's kills been reviewed".
   */
  const hasKills = (pairing: PairingWithResults): boolean =>
    (pairing.round_results ?? []).some(r => r.number_of_kills !== null)

  const isDraw = (pairing: PairingWithResults): boolean =>
    isPairingDraw(pairing, rankingsStore.getRankingWithRanks(pairing.pairing_id))

  /**
   * Returns true if all required data has been entered for a pairing:
   * - Rankings are saved
   * - All players have a commander set
   * - All players have submitted a vote
   */
  const isTableComplete = (pairing: Pairing): boolean => {
    const playerIds = getPairingPlayerIds(pairing)
    return (
      hasRanking(pairing) &&
      playerIds.every(id => commandersStore.getCommander1(id) !== null) &&
      playerIds.every(id => votesStore.hasVotes(id))
    )
  }

  return { hasRanking, hasKills, isDraw, isTableComplete }
}
