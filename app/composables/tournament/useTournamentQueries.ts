// app\composables\tournament\useTournamentQueries.ts
// Pinia Colada queries for the tournament domain's cache-like reads (ADR-015):
// tournaments list per league, per-tournament standings, per-round pairings,
// pairing history. Reads stay client → Supabase (ADR-013). The tournament
// store keeps only the lifecycle state machine — these queries are
// refreshed/invalidated by useTournamentPage after lifecycle writes.
import type { Tournament, StandingWithPlayer, Pairing, PairingWithResults, Kill, Player, PaymentMethod } from '#shared/utils/types'
import type { Database } from '#shared/utils/types/database'
import type { PairingHistoryEntry } from '~/composables/event-pairing/pairingOptimizer'
import { aggregatePointBreakdowns, resolveTournamentRuleset } from '#shared/utils/roundScoring'
import type { PlayerPointBreakdown } from '#shared/utils/roundScoring'
import { compareStandings } from '#shared/utils/standingsSort'

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

/**
 * Payment method per player for one or more tournaments (tournament_payments)
 * — fetched separately and merged client-side, no join, same recompute-on-read
 * pattern as kills/placementPoints. Written once at tournament start
 * (server/api/tournaments/:id/start.post.ts) and never touched again.
 */
async function fetchTournamentPayments(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  tournamentIds: number[]
): Promise<Map<number, PaymentMethod>> {
  const payments = new Map<number, PaymentMethod>()
  if (!tournamentIds.length) return payments

  const { data, error } = await supabase
    .from('tournament_payments')
    .select('player_id, payment_method')
    .in('tournament_id', tournamentIds)

  if (error) throw error

  for (const row of data ?? []) {
    payments.set(row.player_id, row.payment_method as PaymentMethod)
  }

  return payments
}

/** Query key for a single tournament's standings — refreshed after round transitions. */
export const EVENT_STANDINGS_KEY = ['event-standings']

/** Row shape selected by `useEventStandingsQuery`'s `standings` query — exported for its merge test. */
export interface EventStandingRow {
  standing_id: number
  tournament_id: number | null
  player_id: number
  standing_player_score: number | null
  standing_player_rank: number | null
  victories: number | null
  brew_received: number | null
  play_received: number | null
  players: Pick<Player, 'player_id' | 'player_name' | 'player_surname'> | null
}

/**
 * Merges the recomputed point breakdown onto each standings row and applies
 * the shared tie-break sort. Pulled out of `useEventStandingsQuery` so the
 * merge+sort — the part that silently used arbitrary DB row order for tied
 * scores before the 2026-07-31 fix — is unit-testable without a Supabase
 * client. Unlike the league-wide version, rows here are already one per
 * player (single tournament, no summing across tournaments needed), so the
 * real persisted standing_id/tournament_id/standing_player_rank are kept as-is.
 */
export function mergeEventStandings(
  rows: EventStandingRow[],
  breakdowns: Map<number, PlayerPointBreakdown>,
  payments: Map<number, PaymentMethod> = new Map()
): StandingWithPlayer[] {
  return rows
    .map(s => ({
      ...s,
      kills: breakdowns.get(s.player_id)?.kills ?? 0,
      placementPoints: breakdowns.get(s.player_id)?.placementPoints ?? 0,
      killPoints: breakdowns.get(s.player_id)?.killPoints ?? 0,
      brewPoints: breakdowns.get(s.player_id)?.brewPoints ?? 0,
      playPoints: breakdowns.get(s.player_id)?.playPoints ?? 0,
      paymentMethod: payments.get(s.player_id) ?? null,
      players: s.players
        ? sanitizePlayer({
          player_id: s.players.player_id,
          player_name: s.players.player_name,
          player_surname: s.players.player_surname,
        }) as Player
        : undefined,
    }))
    .sort(compareStandings)
}

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

      let breakdowns = new Map<number, PlayerPointBreakdown>()
      if (pairingsData?.length) {
        const { posValues, ruleset } = await resolveTournamentRuleset(supabase, tournamentId)
        breakdowns = aggregatePointBreakdowns(pairingsData, posValues, ruleset)
      }

      const payments = await fetchTournamentPayments(supabase, [tournamentId])

      return mergeEventStandings(data ?? [], breakdowns, payments)
    },
  })
}

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
