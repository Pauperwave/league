// server\api\players\create.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): create a player. Returns the raw row — the client
// keeps applying sanitizePlayer on receipt, same as it does on reads.
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const body = await requireValidBody(event, playerFormBodySchema)

  console.log('[api/players/create] request', body)

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { data, error } = await supabase
    .from('players')
    .insert(body)
    .select()
    .single()

  if (error || !data) {
    console.error('[api/players/create] insert failed', { body, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Player insert failed'
    })
  }

  console.log('[api/players/create] created', { playerId: data.player_id })
  return { player: data }
})
