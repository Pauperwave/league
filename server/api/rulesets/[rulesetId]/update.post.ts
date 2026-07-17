// server\api\rulesets\[rulesetId]\update.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): update a ruleset's form fields.
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const rulesetId = requireIdParam(event, 'rulesetId')
  const body = await requireValidBody(event, rulesetFormBodySchema)

  console.log('[api/rulesets/update] request', { rulesetId, name: body.name })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { data, error } = await supabase
    .from('rulesets')
    .update(body)
    .eq('ruleset_id', rulesetId)
    .select()
    .single()

  if (error || !data) {
    // PGRST116 = zero rows matched the filter — the ruleset doesn't exist.
    if (error?.code === 'PGRST116') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Ruleset not found'
      })
    }
    console.error('[api/rulesets/update] update failed', { rulesetId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Ruleset update failed'
    })
  }

  console.log('[api/rulesets/update] updated', { rulesetId })
  return { ruleset: data }
})
