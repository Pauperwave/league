// server\api\pairings\[pairingId]\kills.post.ts
// BFF slice (ADR-013): save a table's confirmed kill counts into round_results.
import * as v from 'valibot'

const bodySchema = v.object({
  killCounts: v.pipe(
    v.array(v.object({
      playerId: v.pipe(v.number(), v.integer(), v.minValue(1)),
      count: v.pipe(v.number(), v.integer(), v.minValue(0)),
    })),
    v.minLength(1),
  ),
})

export default defineEventHandler(async (event) => {
  const { pairingId, supabase, playerIds } = await requirePairingContext(event)

  const parsed = v.safeParse(bodySchema, await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
  }
  const { killCounts } = parsed.output

  if (!killCounts.every(k => playerIds.includes(k.playerId))) {
    throw createError({ statusCode: 400, statusMessage: 'A player is not seated at this pairing' })
  }

  console.log('[api/pairings/kills] request', { pairingId, killCounts })

  try {
    for (const { playerId, count } of killCounts) {
      await upsertRoundResult(supabase, pairingId, playerId, { number_of_kills: count })
    }
  } catch (err) {
    console.error('[api/pairings/kills] upsert failed', { pairingId, err })
    throw createError({ statusCode: 500, statusMessage: err instanceof Error ? err.message : 'Kills save failed' })
  }

  console.log('[api/pairings/kills] done', { pairingId, updated: killCounts.length })
  return { updated: killCounts.length }
})
