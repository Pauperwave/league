// server\api\avoid-pairs\create.post.ts
// BFF (ADR-013): add a globally-fixed avoid-pair. Normalizes the two player
// ids into (min, max) order before insert — the DB CHECK constraint
// (player_a_id < player_b_id) enforces exactly one canonical row per
// unordered pair.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const { playerA, playerB } = await requireValidBody(event, avoidPairBodySchema)

  const [playerAId, playerBId] = playerA < playerB ? [playerA, playerB] : [playerB, playerA]

  logInfo('api/avoid-pairs/create', 'request', { playerAId, playerBId })

  const supabase = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await supabase
    .from('player_avoid_pairs')
    .upsert({ player_a_id: playerAId, player_b_id: playerBId }, { onConflict: 'player_a_id,player_b_id' })
    .select()
    .single()

  if (error || !data) {
    logError('api/avoid-pairs/create', 'insert failed', { playerAId, playerBId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Avoid pair insert failed'
    })
  }

  logInfo('api/avoid-pairs/create', 'created', { playerAId, playerBId })
  return { avoidPair: data }
})
