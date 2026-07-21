// server\api\events\[eventId]\advance-round.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
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
import { serverSupabaseServiceRole } from '#supabase/server'
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
  const eventId = requireIdParam(event, 'eventId')
  const { currentRound, playerOrder } = await requireValidBody(event, bodySchema)

  console.log('[api/advance-round] request', { eventId, currentRound, playerOrderLength: playerOrder?.length ?? 0 })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  // Domain guards: playing phase, and the round the client thinks it is
  // closing must be the round the event is actually at (double-submit/stale
  // tab protection).
  const eventRow = await requireEventRow(supabase, eventId)
  if (!eventRow.event_playing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Event is not in the playing phase'
    })
  }
  if (eventRow.event_current_round !== currentRound) {
    throw createError({
      statusCode: 409,
      statusMessage: `Round mismatch: event is at round ${eventRow.event_current_round}, request is closing round ${currentRound}`
    })
  }

  const newRound = currentRound + 1
  const hasEnded = newRound > (eventRow.event_round_number ?? 0)
  if (!hasEnded && !playerOrder?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'playerOrder is required to create the next round pairings'
    })
  }

  // Recompute standings from scratch over every round through currentRound
  // (idempotent — see fetchRoundData's comment for why this replaced the old
  // add-onto-persisted-value approach, BACKLOG #11/#12).
  try {
    const { ruleset, posValues } = await resolveEventRuleset(supabase, eventId)
    const { pairings, results, standingsMap } = await fetchRoundData(supabase, eventId, currentRound)
    console.log('[api/advance-round] scoring rounds 1..N', { eventId, currentRound, pairings: pairings.length, results: results.length, players: standingsMap.size })
    calculateRoundScores(pairings, results, standingsMap, posValues, ruleset)
    await updateStandingsAndRanks(supabase, eventId, standingsMap)
    console.log('[api/advance-round] standings updated', {
      eventId,
      scores: Array.from(standingsMap.values()).map(s => ({ player: s.player_id, score: s.standing_player_score })),
    })
  } catch (err) {
    console.error('[api/advance-round] scoring failed', { eventId, currentRound, err })
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : 'Round scoring failed'
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
    console.error('[api/advance-round] event update failed', { eventId, newRound, updateError })
    throw createError({
      statusCode: 500,
      statusMessage: updateError?.message ?? 'Event update failed'
    })
  }
  console.log('[api/advance-round] event advanced', { eventId, newRound, hasEnded })

  // Insert the next round's pairings from the confirmed order.
  if (!hasEnded && playerOrder) {
    const rows = buildPairingRows(eventId, newRound, buildRoundOneTables(playerOrder))
    if (!rows.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'playerOrder produced no valid tables'
      })
    }
    const { error: pairingsError } = await supabase.from('pairings').insert(rows)
    if (pairingsError) {
      console.error('[api/advance-round] pairings insert failed', { eventId, newRound, pairingsError })
      throw createError({
        statusCode: 500,
        statusMessage: pairingsError.message
      })
    }
    console.log('[api/advance-round] pairings created', { eventId, newRound, tables: rows.length })
  }

  return { event: updatedEvent, hasEnded }
})
