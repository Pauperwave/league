// server\api\events\[eventId]\update.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): update an event's form fields. The body is a
// partial — only the provided fields are written. Lifecycle transitions are
// NOT this endpoint's job: start/advance-round/turn-back-round own those.
import * as v from 'valibot'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const eventId = requireIdParam(event, 'eventId')
  const body = await requireValidBody(event, v.partial(eventFormBodySchema))

  console.log('[api/events/update] request', { eventId, fields: Object.keys(body) })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await supabase
    .from('events')
    .update(body)
    .eq('event_id', eventId)
    .select()
    .single()

  if (error || !data) {
    // PGRST116 = zero rows matched the filter — the event doesn't exist.
    if (error?.code === 'PGRST116') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Event not found'
      })
    }
    console.error('[api/events/update] update failed', { eventId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Event update failed'
    })
  }

  console.log('[api/events/update] updated', { eventId })
  return { event: data }
})
