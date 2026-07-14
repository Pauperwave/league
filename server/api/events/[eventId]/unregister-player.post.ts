// server\api\events\[eventId]\unregister-player.post.ts
// BFF slice (ADR-013): remove players from an event's waiting list —
// symmetric with register-player.
import * as v from 'valibot'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

const bodySchema = v.object({
  playerIds: v.pipe(
    v.array(v.pipe(v.number(), v.integer(), v.minValue(1))),
    v.minLength(1),
  ),
})

export default defineEventHandler(async (event) => {
  if (getCookie(event, 'site-auth') !== 'authenticated') {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const eventId = Number(getRouterParam(event, 'eventId'))
  if (!Number.isInteger(eventId) || eventId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid event id' })
  }

  const parsed = v.safeParse(bodySchema, await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
  }
  const { playerIds } = parsed.output

  console.log('[api/unregister-player] request', { eventId, playerIds })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { data: removed, error: deleteError } = await supabase
    .from('waitroom')
    .delete()
    .eq('event_id', eventId)
    .in('player_id', playerIds)
    .select('player_id')

  if (deleteError) {
    console.error('[api/unregister-player] delete failed', { eventId, playerIds, deleteError })
    throw createError({ statusCode: 500, statusMessage: deleteError.message })
  }

  const removedIds = (removed ?? []).map(row => row.player_id)
  console.log('[api/unregister-player] done', { eventId, removed: removedIds })
  return { removed: removedIds }
})
