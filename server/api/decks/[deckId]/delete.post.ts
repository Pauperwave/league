// server\api\decks\[deckId]\delete.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints stay independent (ADR-013); shared scaffolding already extracted to server/utils
// BFF wave 4 (ADR-013): delete a commander deck. The "deck was played in an
// event" guard lives here now (it used to be a client-side check — and a
// broken one: head:true never returns rows, so it always saw the deck as
// unused). A 409 is the contract for the in-use case. Decks are matched to
// round_results by player_id + commander names (no FK).
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '#shared/utils/types/database'

export default defineEventHandler(async (event) => {
  const deckId = requireIdParam(event, 'deckId')

  console.log('[api/decks/delete] request', { deckId })

  // Still the anon key for now — see docs/BACKLOG.md #7 for the service-role flip.
  const supabase = await serverSupabaseClient<Database>(event)

  const { data: deck, error: deckError } = await supabase
    .from('commander_decks')
    .select('player_id, commander_1_name, commander_2_name')
    .eq('id', deckId)
    .maybeSingle()

  if (deckError) {
    throw createError({
      statusCode: 500,
      statusMessage: deckError.message
    })
  }
  if (!deck) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Deck not found'
    })
  }

  // Domain guard: refuse to delete a deck that appears in any round result.
  let usageQuery = supabase
    .from('round_results')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', deck.player_id)
    .eq('commander_1', deck.commander_1_name)
  usageQuery = deck.commander_2_name === null
    ? usageQuery.is('commander_2', null)
    : usageQuery.eq('commander_2', deck.commander_2_name)

  const { count, error: usageError } = await usageQuery
  if (usageError) {
    throw createError({
      statusCode: 500,
      statusMessage: usageError.message
    })
  }
  if ((count ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Deck is in use by one or more events'
    })
  }

  const { error } = await supabase
    .from('commander_decks')
    .delete()
    .eq('id', deckId)

  if (error) {
    console.error('[api/decks/delete] delete failed', { deckId, error })
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  console.log('[api/decks/delete] deleted', { deckId })
  return { deleted: true }
})
