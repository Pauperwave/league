// app\composables\supabase\usePlayerMatchHistory.ts

export interface PlayerMatchHistory {
  event_id: number
  event_name: string
  pairing_id: number
  pairing_round: number
  table_number: number
  commander_1: string | null
  commander_2: string | null
  position: number
  number_of_kills: number
  brew_vote: number | null
  play_vote_1: number | null
  play_vote_2: number | null
  pairing_datetime: string
}

export async function fetchPlayerMatchHistory(
  supabase: ReturnType<typeof useSupabaseClient>,
  playerId: number,
): Promise<PlayerMatchHistory[]> {
  const { data, error } = await supabase
    .from('round_results')
    .select(`
      pairing_id,
      commander_1,
      commander_2,
      position,
      number_of_kills,
      brew_vote,
      play_vote_1,
      play_vote_2,
      pairings!inner (
        pairing_round,
        pairing_datetime,
        event_id,
        events:event_id (
          event_name
        )
      )
    `)
    .eq('player_id', playerId)

  if (error) {
    console.error('[fetchPlayerMatchHistory] error:', error)
    return []
  }

  // Flatten nested data and assign table numbers
  const results: PlayerMatchHistory[] = []
  let currentEventId = -1
  let tableCounter = 0

  for (const row of data ?? []) {
    const pairings = row.pairings as Record<string, unknown> | null
    if (!pairings) continue

    const eventId = pairings.event_id as number
    
    // Reset table counter when event changes
    if (eventId !== currentEventId) {
      currentEventId = eventId
      tableCounter = 0
    }
    tableCounter++

    results.push({
      event_id: eventId,
      event_name: pairings.events?.event_name ?? 'Evento sconosciuto',
      pairing_id: row.pairing_id as number,
      pairing_round: pairings.pairing_round as number,
      table_number: tableCounter,
      commander_1: row.commander_1 as string | null,
      commander_2: row.commander_2 as string | null,
      position: row.position as number,
      number_of_kills: row.number_of_kills as number,
      brew_vote: row.brew_vote as number | null,
      play_vote_1: row.play_vote_1 as number | null,
      play_vote_2: row.play_vote_2 as number | null,
      pairing_datetime: pairings.pairing_datetime as string,
    })
  }

  // Sort by pairing datetime descending (newest first)
  results.sort((a, b) => new Date(b.pairing_datetime).getTime() - new Date(a.pairing_datetime).getTime())

  return results
}

/** SSR-friendly composable for fetching player match history */
export function usePlayerMatchHistory(playerId: Ref<number | undefined>) {
  const supabase = useSupabaseClient()

  return useAsyncData<PlayerMatchHistory[]>(
    () => `player-match-history-${playerId.value ?? 'none'}`,
    () => {
      if (!playerId.value) return Promise.resolve([])
      return fetchPlayerMatchHistory(supabase, playerId.value)
    },
    {
      immediate: true,
      default: () => [],
    },
  )
}
