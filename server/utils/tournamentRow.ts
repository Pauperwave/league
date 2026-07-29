// server\utils\tournamentRow.ts
// Shared scaffolding for the /api/events/:tournamentId/* endpoints: fetch the
// tournament's lifecycle columns with the uniform 404. Domain guards stay in each
// endpoint — they differ per intent (ADR-013).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '#shared/utils/types/database'

type TournamentLifecycleRow = Pick<
  Database['public']['Tables']['tournaments']['Row'],
  'tournament_playing' | 'tournament_current_round' | 'tournament_round_number' | 'tournament_registration_open'
>

/**
 * Fetch the lifecycle columns of a tournament, throwing the uniform 404 when it
 * doesn't exist.
 */
export async function requireTournamentRow(
  supabase: SupabaseClient<Database>,
  tournamentId: number,
): Promise<TournamentLifecycleRow> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('tournament_playing, tournament_current_round, tournament_round_number, tournament_registration_open')
    .eq('tournament_id', tournamentId)
    .single()

  if (error || !data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tournament not found'
    })
  }
  return data
}
