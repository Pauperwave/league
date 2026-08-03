// server\api\pairings\[pairingId]\reset.post.ts
// fallow-ignore-file code-duplication -- intent-based sibling endpoints, scaffolding already in server/utils (ADR-013)
// BFF slice (ADR-013): "Resetta tavolo" — clears every persisted value for a
// pairing (kills, ranking/position, commander, votes), unlike `undraw` which
// deliberately leaves commander/votes untouched (a "Patta" never sets them).
// Without this, `handleResetTable` only cleared the local session stores —
// round_results kept the previously-submitted values, so e.g. "Uccisioni"
// still showed as reviewed after a reset (see docs/PROGRESS.md ADR-032 addendum).
export default defineEventHandler(async (event) => {
  const { pairingId, supabase, playerIds } = await requirePairingContext(event)

  console.log('[api/pairings/reset] request', { pairingId })

  try {
    const { error: killsDeleteError } = await supabase
      .from('round_kills')
      .delete()
      .eq('pairing_id', pairingId)

    if (killsDeleteError) throw killsDeleteError

    for (const playerId of playerIds) {
      await upsertRoundResult(supabase, pairingId, playerId, {
        number_of_kills: null,
        position: null,
        commander_1: null,
        commander_2: null,
        brew_vote: null,
        play_vote_1: null,
        play_vote_2: null,
      })
    }
  } catch (err) {
    console.error('[api/pairings/reset] clear failed', { pairingId, err })
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : 'Reset failed'
    })
  }

  console.log('[api/pairings/reset] done', { pairingId, players: playerIds.length })
  return { cleared: playerIds.length }
})
