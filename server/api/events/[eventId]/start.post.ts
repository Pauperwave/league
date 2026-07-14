// server\api\events\[eventId]\start.post.ts
// BFF slice (ADR-013): atomic event start. Owns the whole transition —
// validate the waitroom, create zeroed standings, flip the event to playing,
// clear the waitroom, insert round-1 pairings from the confirmed playerOrder.
import * as v from 'valibot'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'
import { buildRoundOneTables, buildPairingRows } from '#shared/utils/roundScoring'

const bodySchema = v.object({
  playerOrder: v.optional(v.array(v.pipe(v.number(), v.integer(), v.minValue(1)))),
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
  const { playerOrder } = parsed.output

  console.log('[api/start] request', { eventId, playerOrderLength: playerOrder?.length ?? 0 })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  // Domain guards: the event must exist and not be running already.
  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('event_playing, event_current_round')
    .eq('event_id', eventId)
    .single()

  if (eventError || !eventRow) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  if (eventRow.event_playing || (eventRow.event_current_round ?? 0) > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Event has already started' })
  }

  // Validate the waitroom and the confirmed player order against it.
  const { data: waitingPlayers, error: waitingError } = await supabase
    .from('waitroom')
    .select('player_id')
    .eq('event_id', eventId)
    .order('inserted_at', { ascending: true })

  if (waitingError) {
    throw createError({ statusCode: 500, statusMessage: waitingError.message })
  }

  const waitroomIds = (waitingPlayers ?? []).map(player => player.player_id)
  const count = waitroomIds.length
  if (count < 3 || count === 5) {
    throw createError({ statusCode: 409, statusMessage: `Invalid player count: ${count} (needs at least 3, and 5 cannot be seated)` })
  }

  const selectedOrder = playerOrder?.length ? playerOrder : waitroomIds
  const hasSameLength = selectedOrder.length === waitroomIds.length
  const hasValidIds = selectedOrder.every(id => waitroomIds.includes(id))
  const hasUniqueIds = new Set(selectedOrder).size === selectedOrder.length
  if (!hasSameLength || !hasValidIds || !hasUniqueIds) {
    throw createError({ statusCode: 400, statusMessage: 'playerOrder does not match the waitroom players' })
  }

  // Zeroed standings for every player, ranked by the confirmed order.
  const standingsData = selectedOrder.map((playerId, index) => ({
    event_id: eventId,
    player_id: playerId,
    standing_player_score: 0,
    standing_player_rank: index + 1,
    victories: 0,
    brew_received: 0,
    play_received: 0,
  }))

  const { error: standingsError } = await supabase.from('standings').insert(standingsData)
  if (standingsError) {
    console.error('[api/start] standings insert failed', { eventId, standingsError })
    throw createError({ statusCode: 500, statusMessage: standingsError.message })
  }
  console.log('[api/start] standings created', { eventId, players: standingsData.length })

  const { data: updatedEvent, error: updateError } = await supabase
    .from('events')
    .update({ event_playing: true, event_current_round: 1, event_registration_open: false })
    .eq('event_id', eventId)
    .select()
    .single()

  if (updateError || !updatedEvent) {
    console.error('[api/start] event update failed', { eventId, updateError })
    throw createError({ statusCode: 500, statusMessage: updateError?.message ?? 'Event update failed' })
  }

  // Round 1 uses the confirmed player order — no optimizer re-run.
  const rows = buildPairingRows(eventId, 1, buildRoundOneTables(selectedOrder))
  if (!rows.length) {
    throw createError({ statusCode: 400, statusMessage: 'playerOrder produced no valid tables' })
  }

  const [{ error: waitroomError }, { error: pairingsError }] = await Promise.all([
    supabase.from('waitroom').delete().eq('event_id', eventId),
    supabase.from('pairings').insert(rows),
  ])
  if (waitroomError) {
    console.error('[api/start] waitroom clear failed', { eventId, waitroomError })
    throw createError({ statusCode: 500, statusMessage: waitroomError.message })
  }
  if (pairingsError) {
    console.error('[api/start] pairings insert failed', { eventId, pairingsError })
    throw createError({ statusCode: 500, statusMessage: pairingsError.message })
  }

  console.log('[api/start] event started', { eventId, tables: rows.length })
  return { event: updatedEvent }
})
