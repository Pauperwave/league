// app\utils\tableScoreRows.ts
// The "Punteggi Tavolo" (TableScoresModal.vue) row-building logic — pulled
// out so it's unit-testable without mounting Vue/UTable.
import { calculatePlayerTableScore } from '#shared/utils/roundScoring'
import type { PairingWithResults, Ruleset, TablePlayer } from '#shared/utils/types'

export interface TableScoreRow {
  playerId: number
  name: string
  surname: string
  placementPoints: number
  placementUnspecified: boolean
  killPoints: number
  killUnspecified: boolean
  deckPoints: number
  deckUnspecified: boolean
  playPoints: number
  playUnspecified: boolean
  total: number
}

function getPairingPlayerIds(pairing: PairingWithResults): number[] {
  return [
    pairing.pairing_player1_id,
    pairing.pairing_player2_id,
    pairing.pairing_player3_id,
    pairing.pairing_player4_id,
  ].filter((id): id is number => id !== null)
}

/** All seated player ids except the given one — a player's deck/play points
 *  are the sum of votes cast by others, so they're "unspecified" until all
 *  others have submitted, not until this player's own row exists. */
function getOtherPlayerIds(pairing: PairingWithResults, playerId: number): number[] {
  return getPairingPlayerIds(pairing).filter(id => id !== playerId)
}

/** A vote is "cast" once the player's round_results row has either field set
 *  — null in both means they haven't visited the votes modal yet, not that
 *  they explicitly abstained on both (same convention as votesStore.hasVotes
 *  / buildStandingsSubmissionMap). */
function hasCastVotes(tableResults: PairingWithResults['round_results'], playerId: number): boolean {
  const result = (tableResults ?? []).find(r => r.player_id === playerId)
  return !!result && (result.brew_vote !== null || result.play_vote_1 !== null)
}

/** Build the "Punteggi Tavolo" table rows for one pairing — real ruleset
 *  point values (via calculatePlayerTableScore) plus per-column "not yet
 *  entered" flags derived from the persisted round_results, not from
 *  whether the resulting point value happens to be zero. */
export function buildTableScoreRows(
  pairing: PairingWithResults | null,
  allPlayers: TablePlayer[],
  ruleset: Ruleset | null,
): TableScoreRow[] {
  if (!pairing) return []

  const posValues = [
    0,
    ruleset?.rule_set_rank1 ?? 0,
    ruleset?.rule_set_rank2 ?? 0,
    ruleset?.rule_set_rank3 ?? 0,
    ruleset?.rule_set_rank4 ?? 0,
  ]
  const tableResults = pairing.round_results ?? []

  const rows = getPairingPlayerIds(pairing)
    .map(id => allPlayers.find(p => p.id === id))
    .filter((p): p is TablePlayer => !!p)
    .map((player) => {
      const myResult = tableResults.find(r => r.player_id === player.id)
      const scored = calculatePlayerTableScore(player.id, tableResults, posValues, ruleset)
      const otherIds = getOtherPlayerIds(pairing, player.id)

      return {
        playerId: player.id,
        name: player.name,
        surname: player.surname,
        placementPoints: scored?.scoreRank ?? 0,
        placementUnspecified: (myResult?.position ?? null) === null,
        killPoints: scored?.killScore ?? 0,
        killUnspecified: (myResult?.number_of_kills ?? null) === null,
        deckPoints: scored?.brewScore ?? 0,
        deckUnspecified: otherIds.some(id => !hasCastVotes(tableResults, id)),
        playPoints: scored?.playScore ?? 0,
        playUnspecified: otherIds.some(id => !hasCastVotes(tableResults, id)),
        total: scored?.totalScore ?? 0,
      }
    })

  // Highest total first; ties broken by placement (the actual in-game
  // finish order) instead of arbitrary seat order.
  return rows.sort((a, b) => b.total - a.total || b.placementPoints - a.placementPoints)
}
