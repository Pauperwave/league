// server\api\tournaments\[tournamentId]\start.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints, scaffolding already in server/utils (ADR-013)
// BFF slice (ADR-013): atomic tournament start. Owns the whole transition —
// validate the waitroom, create zeroed standings, flip the tournament to playing,
// clear the waitroom, insert round-1 pairings from the confirmed playerOrder.
import * as v from 'valibot'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

const bodySchema = v.object({
  playerOrder: v.optional(v.array(v.pipe(v.number(), v.integer(), v.minValue(1)))),
  payments: v.optional(v.array(v.object({
    playerId: v.pipe(v.number(), v.integer(), v.minValue(1)),
    paymentMethod: v.picklist(['pos', 'cash']),
  }))),
})

export default defineEventHandler(async (event) => {
  const tournamentId = requireIdParam(event, 'tournamentId')
  const { playerOrder, payments } = await requireValidBody(event, bodySchema)

  logInfo('api/start', 'request', { tournamentId, playerOrderLength: playerOrder?.length ?? 0 })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this
  // endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  // Domain guards: the tournament must exist and not be running already.
  const tournamentRow = await requireTournamentRow(supabase, tournamentId)
  if (tournamentRow.tournament_playing || (tournamentRow.tournament_current_round ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Tournament has already started'
    })
  }

  // Validate the waitroom and the confirmed player order against it. inserted_at
  // is snapshotted below into tournament_registrations before the waitroom row
  // is deleted — it's the only surviving record of the actual registration time
  // once the tournament is playing/ended.
  const { data: waitingPlayers, error: waitingError } = await supabase
    .from('waitroom')
    .select('player_id, inserted_at')
    .eq('tournament_id', tournamentId)
    .order('inserted_at', { ascending: true })

  if (waitingError) {
    throw createError({
      statusCode: 500,
      statusMessage: waitingError.message
    })
  }

  const waitroomIds = (waitingPlayers ?? []).map(player => player.player_id)
  const insertedAtByPlayerId = new Map(
    (waitingPlayers ?? []).map(player => [player.player_id, player.inserted_at])
  )
  const count = waitroomIds.length
  if (count < 3 || count === 5) {
    throw createError({
      statusCode: 409,
      statusMessage: `Invalid player count: ${count} (needs at least 3, and 5 cannot be seated)`
    })
  }

  const selectedOrder = playerOrder?.length ? playerOrder : waitroomIds
  const hasSameLength = selectedOrder.length === waitroomIds.length
  const hasValidIds = selectedOrder.every(id => waitroomIds.includes(id))
  const hasUniqueIds = new Set(selectedOrder).size === selectedOrder.length
  if (!hasSameLength || !hasValidIds || !hasUniqueIds) {
    throw createError({
      statusCode: 400,
      statusMessage: 'playerOrder does not match the waitroom players'
    })
  }

  // Zeroed standings for every player, ranked by the confirmed order.
  const standingsData = selectedOrder.map((playerId, index) => ({
    tournament_id: tournamentId,
    player_id: playerId,
    standing_player_score: 0,
    standing_player_rank: index + 1,
    victories: 0,
    brew_received: 0,
    play_received: 0,
  }))

  const { error: standingsError } = await supabase.from('standings').insert(standingsData)
  if (standingsError) {
    // 23505 = unique_violation on standings(tournament_id, player_id) — a
    // concurrent/retried start already inserted these rows (BACKLOG #12,
    // TOCTOU between the tournament_playing guard above and this insert). Clean
    // rejection, not a scary 500: the tournament did in fact already start.
    if (standingsError.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Tournament has already started'
      })
    }
    logError('api/start', 'standings insert failed', { tournamentId, standingsError })
    throw createError({
      statusCode: 500,
      statusMessage: standingsError.message
    })
  }
  logInfo('api/start', 'standings created', { tournamentId, players: standingsData.length })

  // Registration snapshot (registered_at + payment method) for every seated
  // player — the only surviving source of this data once the waitroom row
  // below is deleted. Payment method (POS/Contanti) was chosen in the waiting
  // list and is snapshotted here since useWaitingListFlags clears its
  // localStorage the moment this call succeeds; a stale/tampered payload for
  // a player outside selectedOrder is silently dropped rather than rejecting
  // the whole start.
  const paymentByPlayerId = new Map(
    (payments ?? [])
      .filter(p => selectedOrder.includes(p.playerId))
      .map(p => [p.playerId, p.paymentMethod])
  )
  const { error: registrationsError } = await supabase.from('tournament_registrations').insert(
    selectedOrder.map(playerId => ({
      tournament_id: tournamentId,
      player_id: playerId,
      registered_at: insertedAtByPlayerId.get(playerId) ?? null,
      payment_method: paymentByPlayerId.get(playerId) ?? null,
    }))
  )
  if (registrationsError) {
    // Same TOCTOU as the standings insert above: a concurrent/retried start
    // already wrote these rows. Clean 409, not a scary 500.
    if (registrationsError.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Tournament has already started'
      })
    }
    logError('api/start', 'tournament_registrations insert failed', { tournamentId, registrationsError })
    throw createError({
      statusCode: 500,
      statusMessage: registrationsError.message
    })
  }
  logInfo('api/start', 'tournament_registrations recorded', { tournamentId, count: selectedOrder.length })

  const { data: updatedTournament, error: updateError } = await supabase
    .from('tournaments')
    .update({
      tournament_playing: true,
      tournament_current_round: 1,
      tournament_registration_open: false
    })
    .eq('tournament_id', tournamentId)
    .select()
    .single()

  if (updateError || !updatedTournament) {
    logError('api/start', 'tournament update failed', { tournamentId, updateError })
    throw createError({
      statusCode: 500,
      statusMessage: updateError?.message ?? 'Tournament update failed'
    })
  }

  // Round 1 uses the confirmed player order — no optimizer re-run.
  const rows = buildPairingRows(tournamentId, 1, buildRoundOneTables(selectedOrder))
  if (!rows.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'playerOrder produced no valid tables'
    })
  }

  const [{ error: waitroomError }, { error: pairingsError }] = await Promise.all([
    supabase.from('waitroom').delete().eq('tournament_id', tournamentId),
    supabase.from('pairings').insert(rows),
  ])
  if (waitroomError) {
    logError('api/start', 'waitroom clear failed', { tournamentId, waitroomError })
    throw createError({
      statusCode: 500,
      statusMessage: waitroomError.message
    })
  }
  if (pairingsError) {
    logError('api/start', 'pairings insert failed', { tournamentId, pairingsError })
    throw createError({
      statusCode: 500,
      statusMessage: pairingsError.message
    })
  }

  logInfo('api/start', 'tournament started', { tournamentId, tables: rows.length })
  return { event: updatedTournament }
})
