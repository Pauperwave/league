// server\api\rulesets\create.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): create a ruleset, returning the created row so the
// client cache mirrors server truth.
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const body = await requireValidBody(event, rulesetFormBodySchema)

  console.log('[api/rulesets/create] request', { name: body.name })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { data, error } = await supabase
    .from('rulesets')
    .insert(body)
    .select()
    .single()

  if (error || !data) {
    console.error('[api/rulesets/create] insert failed', { name: body.name, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Ruleset insert failed'
    })
  }

  console.log('[api/rulesets/create] created', { rulesetId: data.ruleset_id })
  return { ruleset: data }
})
