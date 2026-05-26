import type { Pairing } from '#shared/utils/types'

type RankingsByPairing = Map<number, number[]>

export function buildStandingsSubmissionMap(
  pairings: Pairing[],
  rankingsByPairing: RankingsByPairing
): Map<number, boolean> {
  const submitted = new Map<number, boolean>()

  for (const pairing of pairings) {
    const ids = [
      pairing.pairing_player1_id,
      pairing.pairing_player2_id,
      pairing.pairing_player3_id,
      pairing.pairing_player4_id,
    ].filter((id): id is number => id !== null)

    const ranking = rankingsByPairing.get(pairing.pairing_id) ?? []
    const hasRanking = ranking.length > 0

    for (const id of ids) {
      submitted.set(id, hasRanking)
    }
  }

  return submitted
}
