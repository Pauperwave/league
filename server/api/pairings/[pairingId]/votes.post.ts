// server\api\pairings\[pairingId]\votes.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF slice (ADR-013): save a player's brew/play votes into round_results.
import * as v from 'valibot'

const bodySchema = v.object({
  playerId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  brewVote: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
  playVote: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
})

export default defineEventHandler(async (event) => {
  const { pairingId, supabase, playerIds } = await requirePairingContext(event)

  const { playerId, brewVote, playVote } = await requireValidBody(event, bodySchema)

  if (!playerIds.includes(playerId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Player is not seated at this pairing'
    })
  }

  console.log('[api/pairings/votes] request', { pairingId, playerId, brewVote, playVote })

  try {
    await upsertRoundResult(supabase, pairingId, playerId, { brew_vote: brewVote, play_vote_1: playVote })
  } catch (err) {
    console.error('[api/pairings/votes] upsert failed', { pairingId, playerId, err })
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : 'Votes save failed'
    })
  }

  console.log('[api/pairings/votes] done', { pairingId, playerId })
  return { saved: true }
})
