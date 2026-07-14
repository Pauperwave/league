// server\api\pairings\[pairingId]\commander.post.ts
// BFF slice (ADR-013): save a player's commander(s) into round_results.
import * as v from 'valibot'

const bodySchema = v.object({
  playerId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  commander1: v.nullable(v.string()),
  commander2: v.nullable(v.string()),
})

export default defineEventHandler(async (event) => {
  const { pairingId, supabase, playerIds } = await requirePairingContext(event)

  const parsed = v.safeParse(bodySchema, await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }
  const { playerId, commander1, commander2 } = parsed.output

  if (!playerIds.includes(playerId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Player is not seated at this pairing'
    })
  }

  console.log('[api/pairings/commander] request', { pairingId, playerId, commander1, commander2 })

  try {
    await upsertRoundResult(supabase, pairingId, playerId, { commander_1: commander1, commander_2: commander2 })
  } catch (err) {
    console.error('[api/pairings/commander] upsert failed', { pairingId, playerId, err })
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : 'Commander save failed'
    })
  }

  console.log('[api/pairings/commander] done', { pairingId, playerId })
  return { saved: true }
})
