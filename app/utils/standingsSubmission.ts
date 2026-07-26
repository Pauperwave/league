// app\utils\standingsSubmission.ts
import type { Pairing } from '#shared/utils/types'

type RankingsByPairing = Map<number, number[]>

/**
 * True when every id in `playerIds` appears in `rankedPlayerIds` — i.e. every
 * seated player has been ranked. Shared with `useTableCompletion.ts`'s
 * `hasRanking` so both agree on the same definition of "table ranked",
 * instead of one checking "some ranking exists" and the other "every seated
 * player is covered".
 */
export function hasCompleteRanking(playerIds: number[], rankedPlayerIds: number[]): boolean {
  return rankedPlayerIds.length > 0 && playerIds.every(id => rankedPlayerIds.includes(id))
}

/**
 * Check if all data for a table is complete (rankings, votes).
 * Returns a map of playerId -> boolean indicating if their table is fully submitted.
 */
export function buildStandingsSubmissionMap(
  pairings: Pairing[],
  rankingsByPairing: RankingsByPairing,
  hasVotesByPlayerId: Map<number, boolean>,
): Map<number, boolean> {
  const submitted = new Map<number, boolean>()

  for (const pairing of pairings) {
    const playerIds = [
      pairing.pairing_player1_id,
      pairing.pairing_player2_id,
      pairing.pairing_player3_id,
      pairing.pairing_player4_id,
    ].filter((id): id is number => id !== null)

    const rankedPlayerIds = rankingsByPairing.get(pairing.pairing_id) ?? []

    const allRankingsComplete = hasCompleteRanking(playerIds, rankedPlayerIds)

    // Check if all players have votes
    const allVotesComplete = playerIds.every(id => hasVotesByPlayerId.get(id) ?? false)

    const tableComplete = allRankingsComplete && allVotesComplete

    for (const id of playerIds) {
      submitted.set(id, tableComplete)
    }
  }

  return submitted
}
