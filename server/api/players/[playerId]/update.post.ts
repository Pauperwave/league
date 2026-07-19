// server\api\players\[playerId]\update.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): update a player's name/surname.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const playerId = requireIdParam(event, 'playerId')
  const body = await requireValidBody(event, playerFormBodySchema)

  console.log('[api/players/update] request', { playerId, ...body })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await supabase
    .from('players')
    .update(body)
    .eq('player_id', playerId)
    .select()
    .single()

  if (error || !data) {
    // PGRST116 = zero rows matched the filter — the player doesn't exist.
    if (error?.code === 'PGRST116') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Player not found'
      })
    }
    console.error('[api/players/update] update failed', { playerId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Player update failed'
    })
  }

  console.log('[api/players/update] updated', { playerId })
  return { player: data }
})
