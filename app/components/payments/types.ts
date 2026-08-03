// app\components\payments\types.ts
import type { MtgFormat, PaymentMethod } from '#shared/utils/types'

/** One row per tournament registration, denormalized with player/tournament/league
 * context — shared shape between the payments overview page (`/payments`) and
 * its chart components. */
export interface PaymentRow {
  playerId: number
  name: string
  surname: string
  tournamentId: number
  tournamentName: string
  tournamentDate: string | null
  leagueId: number | null
  leagueName: string
  format: MtgFormat
  registeredAt: string | null
  paymentMethod: PaymentMethod | null
  amount: number
}
