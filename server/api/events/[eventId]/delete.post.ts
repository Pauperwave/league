// server\api\events\[eventId]\delete.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): delete an event. Related rows (standings, pairings,
// waitroom, round_results) follow the DB's FK behavior, same as the old
// client-side delete.
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const eventId = requireIdParam(event, 'eventId')

  console.log('[api/events/delete] request', { eventId })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('event_id', eventId)

  if (error) {
    console.error('[api/events/delete] delete failed', { eventId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  console.log('[api/events/delete] deleted', { eventId })
  return { deleted: true }
})
