// server\utils\roundResults.ts
// Shared helpers for the round-data BFF endpoints (ADR-013).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

type RoundResultRow = Database['public']['Tables']['round_results']['Row']
export type RoundResultPatch = Partial<Omit<RoundResultRow, 'id' | 'pairing_id' | 'player_id'>>

/**
 * Fetch the player ids seated at a pairing, or null if the pairing doesn't
 * exist — endpoints use this to reject writes for players not at the table.
 */
export async function fetchPairingPlayerIds(
  supabase: SupabaseClient<Database>,
  pairingId: number,
): Promise<number[] | null> {
  const { data, error } = await supabase
    .from('pairings')
    .select('pairing_player1_id, pairing_player2_id, pairing_player3_id, pairing_player4_id')
    .eq('pairing_id', pairingId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return [
    data.pairing_player1_id,
    data.pairing_player2_id,
    data.pairing_player3_id,
    data.pairing_player4_id,
  ].filter((id): id is number => id !== null)
}

/**
 * Upsert a round_results row by (pairing_id, player_id): update the existing
 * row's given fields or insert a new one. Throws on any DB error.
 *
 * A single atomic `ON CONFLICT (pairing_id, player_id) DO UPDATE`, backed by
 * the unique constraint added in `20260722010000_...sql` (BACKLOG #12) —
 * previously a select-then-insert-or-update, which raced two concurrent
 * calls (e.g. a double-click) into inserting two rows for the same seat.
 * That race already produced a real duplicate in production (pairing_id
 * 1152), inflating samePositionCount in calculateRoundScores for everyone at
 * that table, not just the duplicate.
 */
export async function upsertRoundResult(
  supabase: SupabaseClient<Database>,
  pairingId: number,
  playerId: number,
  patch: RoundResultPatch,
): Promise<void> {
  const { error } = await supabase
    .from('round_results')
    .upsert(
      { pairing_id: pairingId, player_id: playerId, ...patch },
      { onConflict: 'pairing_id,player_id' }
    )
  if (error) throw error
}

/**
 * Common request scaffolding for the /api/pairings/:pairingId/* endpoints:
 * pairing id param, pairing existence, and the service-role supabase client
 * (auth is enforced upstream by server/middleware/api-auth.ts). Returns the
 * pairing's player ids for membership validation.
 */
export async function requirePairingContext(event: H3Event) {
  const pairingId = requireIdParam(event, 'pairingId')

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  const playerIds = await fetchPairingPlayerIds(supabase, pairingId)
  if (playerIds === null) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Pairing not found'
    })
  }

  return { pairingId, supabase, playerIds }
}
