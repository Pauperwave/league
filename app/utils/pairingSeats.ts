// app\utils\pairingSeats.ts
import type { Pairing } from '#shared/utils/types'

/** Non-null player IDs seated at a pairing (2 to 4 players). */
export function pairingPlayerIds(pairing: Pairing): number[] {
  return [
    pairing.pairing_player1_id,
    pairing.pairing_player2_id,
    pairing.pairing_player3_id,
    pairing.pairing_player4_id
  ].filter((id): id is number => !!id)
}
