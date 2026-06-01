/**
 * Fetch pairings with nested round_results for a specific event and round.
 * Extracted to avoid duplicating this query in useEventPage.ts and events.ts.
 */
export async function fetchPairingsWithResults(
  supabase: any,
  eventId: number,
  round: number
): Promise<any[]> {
  const { data, error } = await supabase
    .from('pairings')
    .select(`
      *,
      round_results (*)
    `)
    .eq('event_id', eventId)
    .eq('pairing_round', round)
    .order('pairing_id')

  if (error) throw error
  return data ?? []
}
