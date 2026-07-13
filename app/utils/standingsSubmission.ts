// app\utils\standingsSubmission.ts
import type { Pairing } from '#shared/utils/types'

type RankingsByPairing = Map<number, number[]>

/**
 * Check if all data for a table is complete (rankings, votes, kills confirmed).
 * Returns a map of playerId -> boolean indicating if their table is fully submitted.
 */
export function buildStandingsSubmissionMap(
  pairings: Pairing[],
  rankingsByPairing: RankingsByPairing,
  hasVotesByPlayerId: Map<number, boolean>,
  confirmedPairingIds: Set<number>,
): Map<number, boolean> {
  const submitted = new Map<number, boolean>()

  for (const pairing of pairings) {
    const playerIds = [
      pairing.pairing_player1_id,
      pairing.pairing_player2_id,
      pairing.pairing_player3_id,
      pairing.pairing_player4_id,
    ].filter((id): id is number => id !== null)

    const ranking = rankingsByPairing.get(pairing.pairing_id) ?? []

    // Check if all players have rankings
    const allRankingsComplete = playerIds.every(id => ranking.includes(id))

    // Check if all players have votes
    const allVotesComplete = playerIds.every(id => hasVotesByPlayerId.get(id) ?? false)

    // Check if kills have been confirmed for this table (even if zero kills)
    const killsConfirmed = confirmedPairingIds.has(pairing.pairing_id)

    const tableComplete = allRankingsComplete && allVotesComplete && killsConfirmed

    for (const id of playerIds) {
      submitted.set(id, tableComplete)
    }
  }

  return submitted
}
