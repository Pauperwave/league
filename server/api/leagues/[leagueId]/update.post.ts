// server\api\leagues\[leagueId]\update.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): update a league's form fields. Null values clear the
// corresponding columns (same semantics the client-side update always had).
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const leagueId = requireIdParam(event, 'leagueId')
  const { name, startsAt, endsAt, rulesetId } = await requireValidBody(event, leagueFormBodySchema)

  console.log('[api/leagues/update] request', { leagueId, name, startsAt, endsAt, rulesetId })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { data, error } = await supabase
    .from('leagues')
    .update({
      name,
      starts_at: startsAt,
      ends_at: endsAt,
      ruleset_id: rulesetId,
    })
    .eq('id', leagueId)
    .select()
    .single()

  if (error || !data) {
    // PGRST116 = zero rows matched the filter — the league doesn't exist.
    if (error?.code === 'PGRST116') {
      throw createError({
        statusCode: 404,
        statusMessage: 'League not found'
      })
    }
    console.error('[api/leagues/update] update failed', { leagueId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'League update failed'
    })
  }

  console.log('[api/leagues/update] updated', { leagueId })
  return { league: data }
})
