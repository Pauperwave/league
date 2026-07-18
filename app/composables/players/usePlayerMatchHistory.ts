// app\composables\players\usePlayerMatchHistory.ts
import type { Database } from '#shared/utils/types/database'

export interface PlayerMatchHistory {
  event_id: number
  league_id: number
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

interface RawMatchRow {
  pairing_id: number
  commander_1: string | null
  commander_2: string | null
  position: number
  number_of_kills: number
  brew_vote: number | null
  play_vote_1: number | null
  play_vote_2: number | null
  pairings: {
    pairing_round: number
    pairing_datetime: string
    event_id: number
    events: { event_name: string; league_id: number } | null
  } | null
}

export async function fetchPlayerMatchHistory(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  playerId: number,
  unknownEventName: string,
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
          event_name,
          league_id
        )
      )
    `)
    .eq('player_id', playerId)
    .order('pairing_id', { ascending: true })

  if (error) {
    console.error('[fetchPlayerMatchHistory] error:', error)
    return []
  }

  // Flatten nested data and assign table numbers
  const results: PlayerMatchHistory[] = []
  let currentEventId = -1
  let tableCounter = 0

  const rows = (data ?? []) as unknown as RawMatchRow[]
  for (const row of rows) {
    const pairings = row.pairings
    if (!pairings) continue

    const eventId = pairings.event_id

    // Reset table counter when event changes
    if (eventId !== currentEventId) {
      currentEventId = eventId
      tableCounter = 0
    }
    tableCounter++

    results.push({
      event_id: eventId,
      league_id: pairings.events?.league_id ?? 0,
      event_name: pairings.events?.event_name ?? unknownEventName,
      pairing_id: row.pairing_id,
      pairing_round: pairings.pairing_round,
      table_number: tableCounter,
      commander_1: row.commander_1,
      commander_2: row.commander_2,
      position: row.position,
      number_of_kills: row.number_of_kills,
      brew_vote: row.brew_vote,
      play_vote_1: row.play_vote_1,
      play_vote_2: row.play_vote_2,
      pairing_datetime: pairings.pairing_datetime,
    })
  }

  // Sort by pairing datetime descending (newest first)
  results.sort((a, b) => new Date(b.pairing_datetime).getTime() - new Date(a.pairing_datetime).getTime())

  return results
}

/** Query key for a player's match history. */
export const PLAYER_MATCH_HISTORY_KEY = ['player-match-history']

/** A player's match history across all events (Colada, ADR-015). */
export function usePlayerMatchHistory(playerId: MaybeRefOrGetter<number | undefined>) {
  const supabase = useSupabaseClient()
  const { t } = useI18n()
  const unknownEventName = t('player.matchHistory.unknownEvent')

  const { data, isLoading, error } = useQuery({
    key: () => [...PLAYER_MATCH_HISTORY_KEY, toValue(playerId) ?? 'none'],
    enabled: () => toValue(playerId) !== undefined,
    query: (): Promise<PlayerMatchHistory[]> => {
      const id = toValue(playerId)
      if (!id) return Promise.resolve([])
      return fetchPlayerMatchHistory(supabase, id, unknownEventName)
    },
  })

  return { data: computed(() => data.value ?? []), pending: isLoading, error }
}
