// server\api\decks\[deckId]\update.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): update a commander deck. The body is a partial —
// only the provided fields are written.
import * as v from 'valibot'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const deckId = requireIdParam(event, 'deckId')
  const body = await requireValidBody(event, v.partial(deckFormBodySchema))

  console.log('[api/decks/update] request', { deckId, fields: Object.keys(body) })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { data, error } = await supabase
    .from('commander_decks')
    .update(body)
    .eq('id', deckId)
    .select()
    .single()

  if (error || !data) {
    // PGRST116 = zero rows matched the filter — the deck doesn't exist.
    if (error?.code === 'PGRST116') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Deck not found'
      })
    }
    console.error('[api/decks/update] update failed', { deckId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error?.message ?? 'Deck update failed'
    })
  }

  console.log('[api/decks/update] updated', { deckId })
  return { deck: data }
})
