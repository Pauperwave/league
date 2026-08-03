// server\api\tournaments\[tournamentId]\advance-round.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints, scaffolding already in server/utils (ADR-013)
// BFF slice (ADR-013): atomic round transition. Owns the whole sequence that
// the client used to orchestrate — score the closing round, accumulate
// standings, advance (or end) the tournament, insert the next round's pairings —
// so a mid-sequence client death can no longer leave the DB half-updated.
//
// The pairing optimizer stays CLIENT-side on purpose: it is pure computation
// plus device-local preferences (localStorage), and the preview modal is where
// the organizer confirms the result. This endpoint receives that confirmed
// `playerOrder` and only turns it into rows.
import * as v from 'valibot'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

const bodySchema = v.object({
  currentRound: v.pipe(v.number(), v.integer(), v.minValue(1)),
  playerOrder: v.optional(v.array(v.pipe(v.number(), v.integer(), v.minValue(1)))),
})

export default defineEventHandler(async (event) => {
  const tournamentId = requireIdParam(event, 'tournamentId')
  const { currentRound, playerOrder } = await requireValidBody(event, bodySchema)

  logInfo('api/advance-round', 'request', { tournamentId, currentRound, playerOrderLength: playerOrder?.length ?? 0 })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this
  // endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  // Domain guards: playing phase, and the round the client thinks it is
  // closing must be the round the tournament is actually at (double-submit/stale
  // tab protection).
  const tournamentRow = await requireTournamentRow(supabase, tournamentId)
  if (!tournamentRow.tournament_playing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Tournament is not in the playing phase'
    })
  }
  if (tournamentRow.tournament_current_round !== currentRound) {
    throw createError({
      statusCode: 409,
      statusMessage: `Round mismatch: tournament is at round ${tournamentRow.tournament_current_round}, request is closing round ${currentRound}`
    })
  }

  const newRound = currentRound + 1
  const hasEnded = newRound > (tournamentRow.tournament_round_number ?? 0)
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
    const { ruleset, posValues } = await resolveTournamentRuleset(supabase, tournamentId)
    const { pairings, results, standingsMap } = await fetchRoundData(
      supabase, tournamentId, currentRound
    )
    logInfo('api/advance-round', 'scoring rounds 1..N', {
      tournamentId,
      currentRound,
      pairings: pairings.length,
      results: results.length,
      players: standingsMap.size
    })
    calculateRoundScores(pairings, results, standingsMap, posValues, ruleset)
    await updateStandingsAndRanks(supabase, tournamentId, standingsMap)
    logInfo('api/advance-round', 'standings updated', {
      tournamentId,
      scores: Array.from(standingsMap.values())
        .map(s => ({ player: s.player_id, score: s.standing_player_score })),
    })
  } catch (err) {
    logError('api/advance-round', 'scoring failed', { tournamentId, currentRound, err })
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : 'Round scoring failed'
    })
  }

  // Advance (or end) the tournament in a single update.
  const { data: updatedTournament, error: updateError } = await supabase
    .from('tournaments')
    .update({
      tournament_current_round: newRound,
      ...(hasEnded ? { tournament_playing: false } : {})
    })
    .eq('tournament_id', tournamentId)
    .select()
    .single()

  if (updateError || !updatedTournament) {
    logError('api/advance-round', 'tournament update failed', { tournamentId, newRound, updateError })
    throw createError({
      statusCode: 500,
      statusMessage: updateError?.message ?? 'Tournament update failed'
    })
  }
  logInfo('api/advance-round', 'tournament advanced', { tournamentId, newRound, hasEnded })

  // Insert the next round's pairings from the confirmed order.
  if (!hasEnded && playerOrder) {
    const rows = buildPairingRows(tournamentId, newRound, buildRoundOneTables(playerOrder))
    if (!rows.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'playerOrder produced no valid tables'
      })
    }
    const { error: pairingsError } = await supabase.from('pairings').insert(rows)
    if (pairingsError) {
      logError('api/advance-round', 'pairings insert failed', { tournamentId, newRound, pairingsError })
      throw createError({
        statusCode: 500,
        statusMessage: pairingsError.message
      })
    }
    logInfo('api/advance-round', 'pairings created', { tournamentId, newRound, tables: rows.length })
  }

  return { event: updatedTournament, hasEnded }
})
