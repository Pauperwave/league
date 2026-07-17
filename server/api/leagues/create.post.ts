// server\api\leagues\create.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): create a league. Owns the server-side default
// (status 'scheduled') and returns the created row so the client cache
// mirrors server truth.
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const { name, startsAt, endsAt, rulesetId } = await requireValidBody(event, leagueFormBodySchema)

  console.log('[api/leagues/create] request', { name, startsAt, endsAt, rulesetId })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { data, error } = await supabase
    .from('leagues')
    .insert({
      name,
      starts_at: startsAt ?? undefined,
      ends_at: endsAt ?? undefined,
      status: 'scheduled',
      ruleset_id: rulesetId ?? undefined,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[api/leagues/create] insert failed', { name, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'League insert failed'
    })
  }

  console.log('[api/leagues/create] created', { leagueId: data.id })
  return { league: data }
})
