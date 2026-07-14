// server\api\events\[eventId]\advance-round.post.ts
// BFF slice (ADR-013): atomic round transition. Owns the whole sequence that
// the client used to orchestrate — score the closing round, accumulate
// standings, advance (or end) the event, insert the next round's pairings —
// so a mid-sequence client death can no longer leave the DB half-updated.
//
// The pairing optimizer stays CLIENT-side on purpose: it is pure computation
// plus device-local preferences (localStorage), and the preview modal is where
// the organizer confirms the result. This endpoint receives that confirmed
// `playerOrder` and only turns it into rows.
import * as v from 'valibot'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'
import {
  resolveEventRuleset,
  fetchRoundData,
  calculateRoundScores,
  updateStandingsAndRanks,
  buildRoundOneTables,
  buildPairingRows,
} from '#shared/utils/roundScoring'

const bodySchema = v.object({
  currentRound: v.pipe(v.number(), v.integer(), v.minValue(1)),
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
  const { currentRound, playerOrder } = parsed.output

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  // Domain guards: playing phase, and the round the client thinks it is
  // closing must be the round the event is actually at (double-submit/stale
  // tab protection).
  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('event_playing, event_current_round, event_round_number')
    .eq('event_id', eventId)
    .single()

  if (eventError || !eventRow) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }
  if (!eventRow.event_playing) {
    throw createError({ statusCode: 409, statusMessage: 'Event is not in the playing phase' })
  }
  if (eventRow.event_current_round !== currentRound) {
    throw createError({
      statusCode: 409,
      statusMessage: `Round mismatch: event is at round ${eventRow.event_current_round}, request is closing round ${currentRound}`,
    })
  }

  const newRound = currentRound + 1
  const hasEnded = newRound > (eventRow.event_round_number ?? 0)
  if (!hasEnded && !playerOrder?.length) {
    throw createError({ statusCode: 400, statusMessage: 'playerOrder is required to create the next round pairings' })
  }

  // Score the closing round and accumulate into standings.
  try {
    const { ruleset, posValues } = await resolveEventRuleset(supabase, eventId)
    const { pairings, results, standingsMap } = await fetchRoundData(supabase, eventId, currentRound)
    calculateRoundScores(pairings, results, standingsMap, posValues, ruleset)
    await updateStandingsAndRanks(supabase, eventId, standingsMap)
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : 'Round scoring failed',
    })
  }

  // Advance (or end) the event in a single update.
  const { data: updatedEvent, error: updateError } = await supabase
    .from('events')
    .update({ event_current_round: newRound, ...(hasEnded ? { event_playing: false } : {}) })
    .eq('event_id', eventId)
    .select()
    .single()

  if (updateError || !updatedEvent) {
    throw createError({ statusCode: 500, statusMessage: updateError?.message ?? 'Event update failed' })
  }

  // Insert the next round's pairings from the confirmed order.
  if (!hasEnded && playerOrder) {
    const rows = buildPairingRows(eventId, newRound, buildRoundOneTables(playerOrder))
    if (!rows.length) {
      throw createError({ statusCode: 400, statusMessage: 'playerOrder produced no valid tables' })
    }
    const { error: pairingsError } = await supabase.from('pairings').insert(rows)
    if (pairingsError) {
      throw createError({ statusCode: 500, statusMessage: pairingsError.message })
    }
  }

  return { event: updatedEvent, hasEnded }
})
