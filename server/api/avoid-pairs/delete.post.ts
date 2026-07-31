// server\api\avoid-pairs\delete.post.ts
// BFF (ADR-013): remove a globally-fixed avoid-pair. Normalizes the two
// player ids the same way create.post.ts does, since the DB row is always
// stored with player_a_id < player_b_id.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const { playerA, playerB } = await requireValidBody(event, avoidPairBodySchema)

  const [playerAId, playerBId] = playerA < playerB ? [playerA, playerB] : [playerB, playerA]

  console.log('[api/avoid-pairs/delete] request', { playerAId, playerBId })

  const supabase = serverSupabaseServiceRole<Database>(event)

  const { error } = await supabase
    .from('player_avoid_pairs')
    .delete()
    .eq('player_a_id', playerAId)
    .eq('player_b_id', playerBId)

  if (error) {
    console.error('[api/avoid-pairs/delete] delete failed', { playerAId, playerBId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  console.log('[api/avoid-pairs/delete] deleted', { playerAId, playerBId })
  return { deleted: true }
})
