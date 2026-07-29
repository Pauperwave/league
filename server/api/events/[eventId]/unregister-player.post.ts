// server\api\events\[tournamentId]\unregister-player.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF slice (ADR-013): remove players from an event's waiting list —
// symmetric with register-player.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const tournamentId = requireIdParam(event, 'tournamentId')
  const { playerIds } = await requireValidBody(event, playerIdsBodySchema)

  console.log('[api/unregister-player] request', { tournamentId, playerIds })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  const { data: removed, error: deleteError } = await supabase
    .from('waitroom')
    .delete()
    .eq('tournament_id', tournamentId)
    .in('player_id', playerIds)
    .select('player_id')

  if (deleteError) {
    console.error('[api/unregister-player] delete failed', { tournamentId, playerIds, deleteError })
    throw createError({
      statusCode: 500,
      statusMessage: deleteError.message
    })
  }

  const removedIds = (removed ?? []).map(row => row.player_id)
  console.log('[api/unregister-player] done', { tournamentId, removed: removedIds })
  return { removed: removedIds }
})
