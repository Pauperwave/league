// app\composables\event\useEventQueries.ts
// Pinia Colada queries for the event domain's cache-like reads (ADR-015):
// events list per league, per-event standings, per-round pairings, pairing
// history. Reads stay client → Supabase (ADR-013). The event store keeps
// only the lifecycle state machine — these queries are refreshed/invalidated
// by useEventPage after lifecycle writes.
import type { Event, StandingWithPlayer, Pairing, PairingWithResults } from '#shared/utils/types'
import type { Database } from '#shared/utils/types/database'
import type { PairingHistoryEntry } from '~/composables/event-pairing/pairingOptimizer'

type PairingRoundIds = Pick<Pairing, 'pairing_round' | 'pairing_player1_id' | 'pairing_player2_id' | 'pairing_player3_id' | 'pairing_player4_id'>

/** Query key for a league's events list — refreshed after event CRUD/lifecycle. */
export const EVENTS_KEY = ['events']

export function useEventsQuery(leagueId: number) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: [...EVENTS_KEY, leagueId],
    query: async (): Promise<Event[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('league_id', leagueId)
        .order('event_datetime', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

/** Query key for a single event's standings — refreshed after round transitions. */
export const EVENT_STANDINGS_KEY = ['event-standings']

/* eslint-disable @typescript-eslint/no-explicit-any */
export function useEventStandingsQuery(eventId: number) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: [...EVENT_STANDINGS_KEY, eventId],
    query: async (): Promise<StandingWithPlayer[]> => {
      const { data, error } = await supabase
        .from('standings')
        .select(`
          *,
          players:player_id (player_id, player_name, player_surname)
        `)
        .eq('event_id', eventId)
        .order('standing_player_score', { ascending: false })

      if (error) throw error

      const { data: pairingIdsData } = await supabase
        .from('pairings')
        .select('pairing_id')
        .eq('event_id', eventId)

      const pairingIds = (pairingIdsData ?? []).map(p => p.pairing_id)

      const killsMap = new Map<number, number>()
      if (pairingIds.length) {
        const { data: resultsData } = await supabase
          .from('round_results')
          .select('player_id, number_of_kills')
          .not('number_of_kills', 'is', null)
          .in('pairing_id', pairingIds)

        for (const r of resultsData ?? []) {
          const pid = r.player_id
          const count = r.number_of_kills ?? 0
          killsMap.set(pid, (killsMap.get(pid) ?? 0) + count)
        }
      }

      return (data ?? []).map(s => ({
        ...s,
        kills: killsMap.get(s.player_id) ?? 0,
        players: s.players
          ? sanitizePlayer({
            player_id: s.players.player_id,
            player_name: s.players.player_name,
            player_surname: s.players.player_surname,
          }) as any
          : undefined,
      })) as StandingWithPlayer[]
    },
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Query key prefix for per-round pairings — invalidated after round transitions. */
export const PAIRINGS_KEY = ['pairings']

/**
 * Fetch pairings with nested round_results for a specific event and round.
 * The query function behind usePairingsQuery, exported for reuse.
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

/**
 * Pairings for a (reactive) round of an event. Two instances with the same
 * key share one cache entry; a reactive round getter (e.g. the viewed round)
 * refetches automatically when it changes.
 */
export function usePairingsQuery(eventId: number, round: MaybeRefOrGetter<number>) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: () => [...PAIRINGS_KEY, eventId, toValue(round)],
    // Round 0 = registration phase, nothing to fetch yet.
    enabled: () => toValue(round) > 0,
    query: () => fetchPairingsWithResults(supabase, eventId, toValue(round)),
  })
}

/** Query key for an event's pairing history (optimizer input). */
export const PAIRING_HISTORY_KEY = ['pairing-history']

/** Map raw pairing rows to PairingHistoryEntry array */
function mapPairingsToHistory(pairings: PairingRoundIds[]): PairingHistoryEntry[] {
  return (pairings ?? []).map(pairing => ({
    round: pairing.pairing_round ?? 0,
    players: [
      pairing.pairing_player1_id,
      pairing.pairing_player2_id,
      pairing.pairing_player3_id,
      pairing.pairing_player4_id,
    ].filter((id): id is number => id !== null),
  }))
}

export function usePairingHistoryQuery(eventId: number) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: [...PAIRING_HISTORY_KEY, eventId],
    query: async (): Promise<PairingHistoryEntry[]> => {
      const { data, error } = await supabase
        .from('pairings')
        .select('pairing_round, pairing_player1_id, pairing_player2_id, pairing_player3_id, pairing_player4_id')
        .eq('event_id', eventId)
        .order('pairing_round', { ascending: true })

      if (error) throw error
      return mapPairingsToHistory(data ?? [])
    },
  })
}
