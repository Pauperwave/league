// server\api\events\[tournamentId]\register-player.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF slice 1 (ADR-013): intent-based endpoint for registering players into an
// event's waiting list. Enforces the site-password gate server-side and owns
// the domain rules (registration must be open, no duplicates), returning the
// rows it actually wrote so the store mirrors server truth.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const tournamentId = requireIdParam(event, 'tournamentId')
  const { playerIds } = await requireValidBody(event, playerIdsBodySchema)

  console.log('[api/register-player] request', { tournamentId, playerIds })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  // Domain guard: the event must exist and registration must be open.
  const tournamentRow = await requireTournamentRow(supabase, tournamentId)
  if (!tournamentRow.tournament_registration_open || tournamentRow.tournament_playing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Registration is closed for this tournament'
    })
  }

  const { data: existing, error: existingError } = await supabase
    .from('waitroom')
    .select('player_id')
    .eq('tournament_id', tournamentId)
    .in('player_id', playerIds)

  if (existingError) {
    throw createError({
      statusCode: 500,
      statusMessage: existingError.message
    })
  }

  const alreadyRegistered = (existing ?? []).map(row => row.player_id)
  const toInsert = playerIds.filter(id => !alreadyRegistered.includes(id))

  let registered: { player_id: number, inserted_at: string | null }[] = []
  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('waitroom')
      .insert(toInsert.map(player_id => ({ tournament_id: tournamentId, player_id })))
      .select('player_id, inserted_at')

    if (insertError) {
      console.error('[api/register-player] insert failed', { tournamentId, toInsert, insertError })
      throw createError({
        statusCode: 500,
        statusMessage: insertError.message
      })
    }
    registered = inserted ?? []
  }

  console.log('[api/register-player] done', { tournamentId, registered: registered.map(r => r.player_id), alreadyRegistered })
  return { registered, alreadyRegistered }
})
