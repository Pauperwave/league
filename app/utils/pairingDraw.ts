// app\utils\pairingDraw.ts
import type { PairingWithResults } from '#shared/utils/types'

/**
 * True when a pairing was resolved as a draw ("Patta"): zero kills for every
 * seated player and everyone tied for first — the exact shape
 * `handleDrawSubmit` (`useEventSubmitHandlers.ts`) writes. There's no
 * separate "was this a draw" flag persisted, so this is derived from the
 * data shape rather than stored directly.
 */
export function isPairingDraw(
  pairing: PairingWithResults,
  ranking: { rank: number }[] | undefined
): boolean {
  const results = pairing.round_results ?? []
  const allZeroKills = results.length > 0 && results.every(r => r.number_of_kills === 0)
  const allTiedFirst = !!ranking && ranking.length > 0 && ranking.every(r => r.rank === 1)
  return allZeroKills && allTiedFirst
}
