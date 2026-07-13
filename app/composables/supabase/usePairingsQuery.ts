// app\composables\supabase\usePairingsQuery.ts
import type { PairingWithResults } from '#shared/utils/types'
import type { Database } from '#shared/utils/types/database'

/**
 * Fetch pairings with nested round_results for a specific event and round.
 * Extracted to avoid duplicating this query in useEventPage.ts and events.ts.
 */
export async function fetchPairingsWithResults(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  eventId: number,
  round: number
): Promise<PairingWithResults[]> {
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
  return (data ?? []) as unknown as PairingWithResults[]
}
