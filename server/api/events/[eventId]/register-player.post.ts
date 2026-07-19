// server\api\events\[eventId]\register-player.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF slice 1 (ADR-013): intent-based endpoint for registering players into an
// event's waiting list. Enforces the site-password gate server-side and owns
// the domain rules (registration must be open, no duplicates), returning the
// rows it actually wrote so the store mirrors server truth.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const eventId = requireIdParam(event, 'eventId')
  const { playerIds } = await requireValidBody(event, playerIdsBodySchema)

  console.log('[api/register-player] request', { eventId, playerIds })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  // Domain guard: the event must exist and registration must be open.
  const eventRow = await requireEventRow(supabase, eventId)
  if (!eventRow.event_registration_open || eventRow.event_playing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Registration is closed for this event'
    })
  }

  const { data: existing, error: existingError } = await supabase
    .from('waitroom')
    .select('player_id')
    .eq('event_id', eventId)
    .in('player_id', playerIds)

  if (existingError) {
    throw createError({
      statusCode: 500,
      statusMessage: existingError.message
    })
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
      throw createError({
        statusCode: 500,
        statusMessage: insertError.message
      })
    }
    registered = inserted ?? []
  }

  console.log('[api/register-player] done', { eventId, registered: registered.map(r => r.player_id), alreadyRegistered })
  return { registered, alreadyRegistered }
})
