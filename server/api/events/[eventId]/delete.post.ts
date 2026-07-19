// server\api\events\[eventId]\delete.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): delete an event. The "event still has pairings/
// standings/waitroom entries" guard lives here (409) — the underlying FKs
// are ON DELETE RESTRICT (2026-07-19 migration), so this is a friendlier
// error than the raw constraint-violation 500 that would otherwise surface.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const eventId = requireIdParam(event, 'eventId')

  console.log('[api/events/delete] request', { eventId })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  // Domain guard: refuse to delete an event that still has pairings,
  // standings, or waitroom entries (round_results are reached transitively
  // through pairings, already RESTRICTed at that level).
  for (const table of ['pairings', 'standings', 'waitroom'] as const) {
    const { count, error: usageError } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)

    if (usageError) {
      throw createError({
        statusCode: 500,
        statusMessage: usageError.message
      })
    }
    if ((count ?? 0) > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `Event still has ${table} entries`
      })
    }
  }

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
