// server\api\decks\create.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): create a commander deck, returning the created row
// so the client cache mirrors server truth.
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const body = await requireValidBody(event, deckFormBodySchema)

  console.log('[api/decks/create] request', { playerId: body.player_id, commander1: body.commander_1_name })

  // Service-role key (BACKLOG #7 flip complete): bypasses RLS entirely — this endpoint is the authorization boundary now, not a DB policy.
  const supabase = serverSupabaseServiceRole<Database>(event)

  const { data, error } = await supabase
    .from('commander_decks')
    .insert(body)
    .select()
    .single()

  if (error || !data) {
    console.error('[api/decks/create] insert failed', { body, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Deck insert failed'
    })
  }

  console.log('[api/decks/create] created', { deckId: data.id })
  return { deck: data }
})
