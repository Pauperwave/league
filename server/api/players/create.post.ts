// server\api\players\create.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints, scaffolding already in server/utils (ADR-013)
// BFF wave 4 (ADR-013): create a player. Returns the raw row — the client
// keeps applying sanitizePlayer on receipt, same as it does on reads.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const body = await requireValidBody(event, playerFormBodySchema)

  logInfo('api/players/create', 'request', body)

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this
  // endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await supabase
    .from('players')
    .insert(body)
    .select()
    .single()

  if (error || !data) {
    logError('api/players/create', 'insert failed', { body, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Player insert failed'
    })
  }

  logInfo('api/players/create', 'created', { playerId: data.player_id })
  return { player: data }
})
