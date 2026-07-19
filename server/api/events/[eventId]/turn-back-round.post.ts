// server\api\events\[eventId]\turn-back-round.post.ts
// BFF slice (ADR-013): atomic round rollback. From round 2+ (or an ended
// event) it reopens the previous round; from round 1 it returns the event to
// the registration phase, wiping standings/pairings and restoring the
// waitroom from the standings players.
import * as v from 'valibot'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

const bodySchema = v.object({
  currentRound: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export default defineEventHandler(async (event) => {
  const eventId = requireIdParam(event, 'eventId')
  const { currentRound } = await requireValidBody(event, bodySchema)

  console.log('[api/turn-back-round] request', { eventId, currentRound })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  // Domain guard: the round the client wants to roll back must be the round
  // the event is actually at (double-submit/stale-tab protection).
  const eventRow = await requireEventRow(supabase, eventId)
  if (eventRow.event_current_round !== currentRound) {
    throw createError({
      statusCode: 409,
      statusMessage: `Round mismatch: event is at round ${eventRow.event_current_round}, request is rolling back round ${currentRound}`
    })
  }

  if (currentRound > 1) {
    // Reopen the previous round: decrement + delete the current round's pairings.
    const [{ data: updatedEvent, error: updateError }, { error: pairingsError }] = await Promise.all([
      supabase
        .from('events')
        .update({ event_current_round: currentRound - 1, event_playing: true })
        .eq('event_id', eventId)
        .select()
        .single(),
      supabase
        .from('pairings')
        .delete()
        .eq('event_id', eventId)
        .eq('pairing_round', currentRound),
    ])

    if (updateError || !updatedEvent) {
      console.error('[api/turn-back-round] event update failed', { eventId, updateError })
      throw createError({
        statusCode: 500,
        statusMessage: updateError?.message ?? 'Event update failed'
      })
    }
    if (pairingsError) {
      console.error('[api/turn-back-round] pairings delete failed', { eventId, currentRound, pairingsError })
      throw createError({
        statusCode: 500,
        statusMessage: pairingsError.message
      })
    }

    console.log('[api/turn-back-round] reopened previous round', { eventId, newRound: currentRound - 1 })
    return { event: updatedEvent }
  }

  // Round 1 → back to registration: fetch players from standings before wiping.
  const { data: standingsData, error: standingsError } = await supabase
    .from('standings')
    .select('player_id')
    .eq('event_id', eventId)

  if (standingsError) {
    throw createError({
      statusCode: 500,
      statusMessage: standingsError.message
    })
  }
  const playerIds = (standingsData ?? []).map(s => s.player_id)

  const [
    { data: updatedEvent, error: updateError },
    { error: wipeStandingsError },
    { error: wipePairingsError },
    { error: waitroomError },
  ] = await Promise.all([
    supabase
      .from('events')
      .update({ event_current_round: 0, event_playing: false, event_registration_open: true })
      .eq('event_id', eventId)
      .select()
      .single(),
    supabase.from('standings').delete().eq('event_id', eventId),
    supabase.from('pairings').delete().eq('event_id', eventId),
    supabase.from('waitroom').insert(playerIds.map(player_id => ({ event_id: eventId, player_id }))),
  ])

  if (updateError || !updatedEvent) {
    console.error('[api/turn-back-round] event reset failed', { eventId, updateError })
    throw createError({
      statusCode: 500,
      statusMessage: updateError?.message ?? 'Event reset failed'
    })
  }
  if (wipeStandingsError) {
    console.error('[api/turn-back-round] standings wipe failed', { eventId, wipeStandingsError })
    throw createError({
      statusCode: 500,
      statusMessage: wipeStandingsError.message
    })
  }
  if (wipePairingsError) {
    console.error('[api/turn-back-round] pairings wipe failed', { eventId, wipePairingsError })
    throw createError({
      statusCode: 500,
      statusMessage: wipePairingsError.message
    })
  }
  if (waitroomError) {
    console.error('[api/turn-back-round] waitroom restore failed', { eventId, playerIds, waitroomError })
    throw createError({
      statusCode: 500,
      statusMessage: waitroomError.message
    })
  }

  console.log('[api/turn-back-round] back to registration', { eventId, restoredPlayers: playerIds.length })
  return { event: updatedEvent }
})
