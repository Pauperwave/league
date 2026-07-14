// server\api\events\[eventId]\register-player.post.ts
// BFF slice 1 (ADR-013): intent-based endpoint for registering players into an
// event's waiting list. Enforces the site-password gate server-side and owns
// the domain rules (registration must be open, no duplicates), returning the
// rows it actually wrote so the store mirrors server truth.
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
  // The password gate, enforced at the API layer (the route middleware only
  // guards page navigation, not direct calls).
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

  console.log('[api/register-player] request', { eventId, playerIds })

  // Still the anon key for now — same DB privileges the client already has.
  // Switching to serverSupabaseServiceRole + denying anon writes on `waitroom`
  // completes this slice (needs SUPABASE_SERVICE_KEY in the deployment env) —
  // see docs/BACKLOG.md #7.
  const supabase = await serverSupabaseClient<Database>(event)

  // Domain guard: the event must exist and registration must be open.
  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('event_registration_open, event_playing')
    .eq('event_id', eventId)
    .single()

  if (eventError || !eventRow) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  if (!eventRow.event_registration_open || eventRow.event_playing) {
    throw createError({ statusCode: 409, statusMessage: 'Registration is closed for this event' })
  }

  const { data: existing, error: existingError } = await supabase
    .from('waitroom')
    .select('player_id')
    .eq('event_id', eventId)
    .in('player_id', playerIds)

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  const alreadyRegistered = (existing ?? []).map(row => row.player_id)
  const toInsert = playerIds.filter(id => !alreadyRegistered.includes(id))

  let registered: { player_id: number, inserted_at: string | null }[] = []
  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('waitroom')
      .insert(toInsert.map(player_id => ({ event_id: eventId, player_id })))
      .select('player_id, inserted_at')

    if (insertError) {
      console.error('[api/register-player] insert failed', { eventId, toInsert, insertError })
      throw createError({ statusCode: 500, statusMessage: insertError.message })
    }
    registered = inserted ?? []
  }

  console.log('[api/register-player] done', { eventId, registered: registered.map(r => r.player_id), alreadyRegistered })
  return { registered, alreadyRegistered }
})
