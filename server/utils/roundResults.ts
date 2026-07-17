// server\utils\roundResults.ts
// Shared helpers for the round-data BFF endpoints (ADR-013).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
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
 */
export async function upsertRoundResult(
  supabase: SupabaseClient<Database>,
  pairingId: number,
  playerId: number,
  patch: RoundResultPatch,
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from('round_results')
    .select('id')
    .eq('pairing_id', pairingId)
    .eq('player_id', playerId)
    .maybeSingle()

  if (selectError) throw selectError

  if (existing) {
    const { error } = await supabase
      .from('round_results')
      .update(patch)
      .eq('pairing_id', pairingId)
      .eq('player_id', playerId)
    if (error) throw error
  }
  else {
    const { error } = await supabase
      .from('round_results')
      .insert({ pairing_id: pairingId, player_id: playerId, ...patch })
    if (error) throw error
  }
}

/**
 * Common request scaffolding for the /api/pairings/:pairingId/* endpoints:
 * pairing id param, pairing existence, and the anon supabase client (auth is
 * enforced upstream by server/middleware/api-auth.ts). Returns the pairing's
 * player ids for membership validation.
 */
export async function requirePairingContext(event: H3Event) {
  const pairingId = requireIdParam(event, 'pairingId')

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const playerIds = await fetchPairingPlayerIds(supabase, pairingId)
  if (playerIds === null) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Pairing not found'
    })
  }

  return { pairingId, supabase, playerIds }
}
