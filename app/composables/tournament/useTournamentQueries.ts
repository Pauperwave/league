// app\composables\tournament\useTournamentQueries.ts
// Pinia Colada queries for the tournament domain's cache-like reads (ADR-015):
// tournaments list per league, per-tournament standings, per-round pairings,
// pairing history. Reads stay client → Supabase (ADR-013). The tournament
// store keeps only the lifecycle state machine — these queries are
// refreshed/invalidated by useTournamentPage after lifecycle writes.
import type { Tournament, StandingWithPlayer, Pairing, PairingWithResults, Kill } from '#shared/utils/types'
import type { Database } from '#shared/utils/types/database'
import type { PairingHistoryEntry } from '~/composables/event-pairing/pairingOptimizer'
import { calculatePlayerTableScore, resolveTournamentRuleset } from '#shared/utils/roundScoring'

type PairingRoundIds = Pick<Pairing, 'pairing_round' | 'pairing_player1_id' | 'pairing_player2_id' | 'pairing_player3_id' | 'pairing_player4_id'>

/** Query key for a league's tournaments list — refreshed after tournament CRUD/lifecycle. */
export const EVENTS_KEY = ['events']

export function useEventsQuery(leagueId: number) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: [...EVENTS_KEY, leagueId],
    query: async (): Promise<Tournament[]> => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('league_id', leagueId)
        .order('tournament_datetime', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

/** Query key for a single tournament's standings — refreshed after round transitions. */
export const EVENT_STANDINGS_KEY = ['event-standings']

/* eslint-disable @typescript-eslint/no-explicit-any */
export function useEventStandingsQuery(tournamentId: number) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: [...EVENT_STANDINGS_KEY, tournamentId],
    query: async (): Promise<StandingWithPlayer[]> => {
      const { data, error } = await supabase
        .from('standings')
        .select(`
          *,
          players:player_id (player_id, player_name, player_surname)
        `)
        .eq('tournament_id', tournamentId)
        .order('standing_player_score', { ascending: false })

      if (error) throw error

      const { data: pairingsData } = await supabase
        .from('pairings')
        .select('pairing_id, round_results (*)')
        .eq('tournament_id', tournamentId)

      const pairingIds = (pairingsData ?? []).map(p => p.pairing_id)

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

      const placementPointsMap = new Map<number, number>()
      if (pairingsData?.length) {
        const { posValues, ruleset } = await resolveTournamentRuleset(supabase, tournamentId)

        for (const pairing of pairingsData) {
          const tableResults = pairing.round_results ?? []
          for (const result of tableResults) {
            const scored = calculatePlayerTableScore(result.player_id, tableResults, posValues, ruleset)
            if (!scored) continue
            placementPointsMap.set(result.player_id, (placementPointsMap.get(result.player_id) ?? 0) + scored.scoreRank)
          }
        }
      }

      return (data ?? []).map(s => ({
        ...s,
        kills: killsMap.get(s.player_id) ?? 0,
        placementPoints: placementPointsMap.get(s.player_id) ?? 0,
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
 * Fetch pairings with nested round_results for a specific tournament and round.
 * The query function behind usePairingsQuery, exported for reuse.
 */
export async function fetchPairingsWithResults(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  tournamentId: number,
  round: number
): Promise<PairingWithResults[]> {
  const { data, error } = await supabase
    .from('pairings')
    .select(`
      *,
      round_results (*)
    `)
    .eq('tournament_id', tournamentId)
    .eq('pairing_round', round)
    .order('pairing_id')

  if (error) throw error
  return (data ?? []) as unknown as PairingWithResults[]
}

/**
 * Pairings for a (reactive) round of a tournament. Two instances with the
 * same key share one cache entry; a reactive round getter (e.g. the viewed
 * round) refetches automatically when it changes.
 */
export function usePairingsQuery(tournamentId: number, round: MaybeRefOrGetter<number>) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: () => [...PAIRINGS_KEY, tournamentId, toValue(round)],
    // Round 0 = registration phase, nothing to fetch yet.
    enabled: () => toValue(round) > 0,
    query: () => fetchPairingsWithResults(supabase, tournamentId, toValue(round)),
  })
}

/** Query key prefix for a pairing's persisted kill events — the kill modal refetches this on open. */
export const ROUND_KILLS_KEY = ['round-kills']

/**
 * Persisted killer->victim pairs for one pairing (round_kills table). The
 * kill modal has no other way to know what's already saved once the local
 * kills-store state for that pairing is gone (a different pairing's modal
 * was opened in between, or the page was reloaded past the localStorage
 * crash-insurance TTL) — see docs/TODO.md's kills-audit entry.
 */
export function useRoundKillsQuery(pairingId: MaybeRefOrGetter<number | null>) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: () => [...ROUND_KILLS_KEY, toValue(pairingId) ?? 'none'],
    enabled: () => toValue(pairingId) !== null,
    query: async (): Promise<Kill[]> => {
      const id = toValue(pairingId)
      if (id === null) return []

      const { data, error } = await supabase
        .from('round_kills')
        .select('killer_id, victim_id')
        .eq('pairing_id', id)

      if (error) throw error
      return (data ?? []).map(k => ({ killerId: k.killer_id, victimId: k.victim_id }))
    },
  })
}

/** Query key for a tournament's pairing history (optimizer input). */
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

export function usePairingHistoryQuery(tournamentId: number) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: [...PAIRING_HISTORY_KEY, tournamentId],
    query: async (): Promise<PairingHistoryEntry[]> => {
      const { data, error } = await supabase
        .from('pairings')
        .select('pairing_round, pairing_player1_id, pairing_player2_id, pairing_player3_id, pairing_player4_id')
        .eq('tournament_id', tournamentId)
        .order('pairing_round', { ascending: true })

      if (error) throw error
      return mapPairingsToHistory(data ?? [])
    },
  })
}
