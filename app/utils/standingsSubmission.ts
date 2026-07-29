// app\utils\standingsSubmission.ts
import type { Pairing } from '#shared/utils/types'
import { getPairingPlayerIds } from '#shared/utils/types'

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
 * Fans a per-pairing completeness map out to a per-player one, for the
 * standings "Inserito" badge. Takes `isCompleteByPairing` as input rather
 * than recomputing rankings/votes/kills itself, so the definition of "table
 * complete" lives in exactly one place — `useTableCompletion.isTableComplete`
 * — instead of drifting between the standings badge and the rest of the UI.
 * Returns a map of playerId -> boolean indicating if their table is fully submitted.
 */
export function buildStandingsSubmissionMap(
  pairings: Pairing[],
  isCompleteByPairing: Map<number, boolean>,
): Map<number, boolean> {
  const submitted = new Map<number, boolean>()

  for (const pairing of pairings) {
    const tableComplete = isCompleteByPairing.get(pairing.pairing_id) ?? false

    for (const id of getPairingPlayerIds(pairing)) {
      submitted.set(id, tableComplete)
    }
  }

  return submitted
}
