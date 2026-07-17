// server\api\leagues\[leagueId]\delete.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): delete a league. A foreign-key violation (league
// still referenced by events) surfaces as the DB error message, same as the
// old client-side delete did.
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const leagueId = requireIdParam(event, 'leagueId')

  console.log('[api/leagues/delete] request', { leagueId })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { error } = await supabase
    .from('leagues')
    .delete()
    .eq('id', leagueId)

  if (error) {
    console.error('[api/leagues/delete] delete failed', { leagueId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  console.log('[api/leagues/delete] deleted', { leagueId })
  return { deleted: true }
})
