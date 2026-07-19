// server\api\leagues\[leagueId]\delete.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): delete a league. The "league still has events" guard
// lives here (409) — the underlying FK is ON DELETE RESTRICT (2026-07-19
// migration; it used to be CASCADE, silently deleting every event under the
// league and everything under those events), so this is a friendlier error
// than the raw constraint-violation 500 that would otherwise surface.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const leagueId = requireIdParam(event, 'leagueId')

  console.log('[api/leagues/delete] request', { leagueId })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  // Domain guard: refuse to delete a league that still has events.
  const { count, error: usageError } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId)

  if (usageError) {
    throw createError({
      statusCode: 500,
      statusMessage: usageError.message
    })
  }
  if ((count ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'League still has events'
    })
  }

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
