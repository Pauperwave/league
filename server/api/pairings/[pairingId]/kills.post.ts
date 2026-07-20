// server\api\pairings\[pairingId]\kills.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF slice (ADR-013): replace a table's kill events (round_kills) and keep
// round_results.number_of_kills in sync as a derived per-player count.
import * as v from 'valibot'

const bodySchema = v.object({
  kills: v.array(v.object({
    killerId: v.pipe(v.number(), v.integer(), v.minValue(1)),
    victimId: v.pipe(v.number(), v.integer(), v.minValue(1)),
  })),
})

export default defineEventHandler(async (event) => {
  const { pairingId, supabase, playerIds } = await requirePairingContext(event)

  const { kills } = await requireValidBody(event, bodySchema)

  if (!kills.every(k => playerIds.includes(k.killerId) && playerIds.includes(k.victimId))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A player is not seated at this pairing'
    })
  }

  console.log('[api/pairings/kills] request', { pairingId, kills })

  try {
    const { error: deleteError } = await supabase
      .from('round_kills')
      .delete()
      .eq('pairing_id', pairingId)
    if (deleteError) throw deleteError

    if (kills.length > 0) {
      const { error: insertError } = await supabase
        .from('round_kills')
        .insert(kills.map(k => ({ pairing_id: pairingId, killer_id: k.killerId, victim_id: k.victimId })))
      if (insertError) throw insertError
    }

    for (const playerId of playerIds) {
      const count = kills.filter(k => k.killerId === playerId).length
      await upsertRoundResult(supabase, pairingId, playerId, { number_of_kills: count })
    }
  } catch (err) {
    console.error('[api/pairings/kills] save failed', { pairingId, err })
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : 'Kills save failed'
    })
  }

  console.log('[api/pairings/kills] done', { pairingId, kills: kills.length })
  return { kills: kills.length }
})
