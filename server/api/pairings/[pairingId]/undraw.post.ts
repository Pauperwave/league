// server\api\pairings\[pairingId]\undraw.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints, scaffolding already in server/utils (ADR-013)
// BFF slice (ADR-013): undo a "Patta" declaration — restores number_of_kills
// and position back to unset (null) for every seated player, matching the
// state before the draw. "Patta" can only be declared on a table with no
// ranking/kills yet (see PairingTableActions.vue's canToggleDraw), so
// nulling both is always the correct pre-draw state to return to. Leaves
// commander_1/2 and vote columns untouched — a draw never wrote those.
export default defineEventHandler(async (event) => {
  const { pairingId, supabase, playerIds } = await requirePairingContext(event)

  console.log('[api/pairings/undraw] request', { pairingId })

  try {
    const { error: killsDeleteError } = await supabase
      .from('round_kills')
      .delete()
      .eq('pairing_id', pairingId)

    if (killsDeleteError) throw killsDeleteError

    for (const playerId of playerIds) {
      await upsertRoundResult(supabase, pairingId, playerId, { number_of_kills: null, position: null })
    }
  } catch (err) {
    console.error('[api/pairings/undraw] clear failed', { pairingId, err })
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : 'Undraw failed'
    })
  }

  console.log('[api/pairings/undraw] done', { pairingId, players: playerIds.length })
  return { cleared: playerIds.length }
})
