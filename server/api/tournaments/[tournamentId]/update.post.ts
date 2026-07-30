// server\api\tournaments\[tournamentId]\update.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): update a tournament's form fields. The body is a
// partial — only the provided fields are written. Lifecycle transitions are
// NOT this endpoint's job: start/advance-round/turn-back-round own those.
import * as v from 'valibot'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const tournamentId = requireIdParam(event, 'tournamentId')
  const body = await requireValidBody(event, v.partial(tournamentFormBodySchema))

  console.log('[api/tournaments/update] request', { tournamentId, fields: Object.keys(body) })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await supabase
    .from('tournaments')
    .update(body)
    .eq('tournament_id', tournamentId)
    .select()
    .single()

  if (error || !data) {
    // PGRST116 = zero rows matched the filter — the tournament doesn't exist.
    if (error?.code === 'PGRST116') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Tournament not found'
      })
    }
    console.error('[api/tournaments/update] update failed', { tournamentId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Tournament update failed'
    })
  }

  console.log('[api/tournaments/update] updated', { tournamentId })
  return { event: data }
})
