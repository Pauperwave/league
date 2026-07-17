// server\api\events\create.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): create an event in its registration phase,
// returning the created row so the client cache mirrors server truth.
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const body = await requireValidBody(event, eventFormBodySchema)

  console.log('[api/events/create] request', { name: body.event_name, leagueId: body.league_id })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { data, error } = await supabase
    .from('events')
    .insert(body)
    .select()
    .single()

  if (error || !data) {
    console.error('[api/events/create] insert failed', { body, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Event insert failed'
    })
  }

  console.log('[api/events/create] created', { eventId: data.event_id })
  return { event: data }
})
