// server\api\rulesets\[rulesetId]\delete.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): delete a ruleset. The "still used by a league" guard
// lives here now (it used to be a bypassable client-side check) — a 409 is
// the contract for that case.
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const rulesetId = requireIdParam(event, 'rulesetId')

  console.log('[api/rulesets/delete] request', { rulesetId })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  // Domain guard: refuse to delete a ruleset any league still references.
  const { data: leaguesUsing, error: checkError } = await supabase
    .from('leagues')
    .select('id')
    .eq('ruleset_id', rulesetId)
    .limit(1)

  if (checkError) {
    throw createError({
      statusCode: 500,
      statusMessage: checkError.message
    })
  }
  if (leaguesUsing && leaguesUsing.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Ruleset is in use by one or more leagues'
    })
  }

  const { error } = await supabase
    .from('rulesets')
    .delete()
    .eq('ruleset_id', rulesetId)

  if (error) {
    console.error('[api/rulesets/delete] delete failed', { rulesetId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  console.log('[api/rulesets/delete] deleted', { rulesetId })
  return { deleted: true }
})
