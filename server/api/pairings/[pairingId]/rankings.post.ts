// server\api\pairings\[pairingId]\rankings.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF slice (ADR-013): save a table's confirmed rankings (positions) into
// round_results. Rejects players not seated at the pairing.
import * as v from 'valibot'

const bodySchema = v.object({
  rankings: v.pipe(
    v.array(v.object({
      playerId: v.pipe(v.number(), v.integer(), v.minValue(1)),
      position: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)),
    })),
    v.minLength(1),
  ),
})

export default defineEventHandler(async (event) => {
  const { pairingId, supabase, playerIds } = await requirePairingContext(event)

  const { rankings } = await requireValidBody(event, bodySchema)

  if (!rankings.every(r => playerIds.includes(r.playerId))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A ranked player is not seated at this pairing'
    })
  }

  console.log('[api/pairings/rankings] request', { pairingId, rankings })

  try {
    for (const { playerId, position } of rankings) {
      await upsertRoundResult(supabase, pairingId, playerId, { position })
    }
  } catch (err) {
    console.error('[api/pairings/rankings] upsert failed', { pairingId, err })
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : 'Rankings save failed'
    })
  }

  console.log('[api/pairings/rankings] done', { pairingId, updated: rankings.length })
  return { updated: rankings.length }
})
