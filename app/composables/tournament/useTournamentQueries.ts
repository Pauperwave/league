// app\composables\tournament\useTournamentQueries.ts
// Pinia Colada queries for the tournament domain's cache-like reads (ADR-015):
// tournaments list per league, per-tournament standings, per-round pairings,
// pairing history. Reads stay client → Supabase (ADR-013). The tournament
// store keeps only the lifecycle state machine — these queries are
// refreshed/invalidated by useTournamentPage after lifecycle writes.
import type { Tournament, StandingWithPlayer, Pairing, PairingWithResults, Kill, Player, PaymentMethod, TournamentRegistration } from '#shared/utils/types'
import type { Database } from '#shared/utils/types/database'
import type { PairingHistoryEntry } from '~/composables/event-pairing/pairingOptimizer'
import type { PlayerPointBreakdown } from '#shared/utils/roundScoring'

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

/** Query key for the tournaments list across every league — the payments overview page. */
export const ALL_EVENTS_KEY = ['events-all']

export function useAllEventsQuery() {
  const supabase = useSupabaseClient()

  return useQuery({
    key: ALL_EVENTS_KEY,
    query: async (): Promise<Tournament[]> => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('tournament_datetime', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * Payment method per player for one or more tournaments (tournament_registrations)
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
    .from('tournament_registrations')
    .select('player_id, payment_method')
    .in('tournament_id', tournamentIds)

  if (error) throw error

  for (const row of data ?? []) {
    if (row.payment_method) payments.set(row.player_id, row.payment_method as PaymentMethod)
  }

  return payments
}

/** Query key for a tournament's registration snapshot — read-only, written once at tournament start. */
export const TOURNAMENT_REGISTRATIONS_KEY = ['tournament-registrations']

/**
 * Read-only registration snapshot (player, when they joined the waitroom,
 * how they paid) for a tournament that has already started — the "click on
 * the Registrazione step" past-registration view. `waitroom` itself is
 * deleted the moment the tournament starts (start.post.ts), so this is the
 * only surviving source for that data once playing/ended.
 */
export function useTournamentRegistrationsQuery(tournamentId: number) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: [...TOURNAMENT_REGISTRATIONS_KEY, tournamentId],
    query: async (): Promise<TournamentRegistration[]> => {
      const { data, error } = await supabase
        .from('tournament_registrations')
        .select('player_id, registered_at, payment_method')
        .eq('tournament_id', tournamentId)
        .order('registered_at', { ascending: true })

      if (error) throw error

      return (data ?? []).map(row => ({
        playerId: row.player_id,
        registeredAt: row.registered_at,
        paymentMethod: row.payment_method as PaymentMethod | null,
      }))
    },
  })
}

/** Query key for every tournament's registration snapshot at once — the payments overview page. */
export const ALL_TOURNAMENT_REGISTRATIONS_KEY = ['tournament-registrations-all']

/**
 * Registration snapshots for every tournament that has one, grouped by
 * tournament_id — same read-only data as `useTournamentRegistrationsQuery`,
 * fetched in one round trip for the cross-league payments overview instead
 * of one query per tournament.
 */
export function useAllTournamentRegistrationsQuery() {
  const supabase = useSupabaseClient()

  return useQuery({
    key: ALL_TOURNAMENT_REGISTRATIONS_KEY,
    query: async (): Promise<Map<number, TournamentRegistration[]>> => {
      const { data, error } = await supabase
        .from('tournament_registrations')
        .select('tournament_id, player_id, registered_at, payment_method')
        .order('registered_at', { ascending: true })

      if (error) throw error

      const byTournament = new Map<number, TournamentRegistration[]>()
      for (const row of data ?? []) {
        const registration: TournamentRegistration = {
          playerId: row.player_id,
          registeredAt: row.registered_at,
          paymentMethod: row.payment_method as PaymentMethod | null,
        }
        const existing = byTournament.get(row.tournament_id)
        if (existing) existing.push(registration)
        else byTournament.set(row.tournament_id, [registration])
      }
      return byTournament
    },
  })
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

/** Query key for a player's 3-player-table count across a league's other tournaments. */
export const LEAGUE_TABLE3_COUNTS_KEY = ['league-table3-counts']

type LeagueTable3CountsRow = PairingRoundIds & { tournaments: { league_id: number } | null }

/**
 * Historical `table3Count` per player across every *other* tournament in the
 * league (`usePairingHistoryQuery` above stays scoped to the current
 * tournament only — it also feeds rematch-avoidance, which must not see
 * other tournaments' rounds). Piggybacks on the same pairings table and
 * query-key/caching setup as `usePairingHistoryQuery` instead of a bespoke
 * fetch, so [tournamentId].vue's round-1/round-2+ table3Count signal
 * (BACKLOG #20) reflects the whole league's history, not just tonight's.
 */
export function useLeagueTable3CountsQuery(leagueId: number, excludeTournamentId: number) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: [...LEAGUE_TABLE3_COUNTS_KEY, leagueId, excludeTournamentId],
    query: async (): Promise<Map<number, number>> => {
      const { data, error } = await supabase
        .from('pairings')
        .select('pairing_player1_id, pairing_player2_id, pairing_player3_id, pairing_player4_id, tournaments!inner(league_id)')
        .eq('tournaments.league_id', leagueId)
        .eq('pairing_is_full', false)
        .neq('tournament_id', excludeTournamentId)

      if (error) throw error

      const counts = new Map<number, number>()
      for (const pairing of (data ?? []) as unknown as LeagueTable3CountsRow[]) {
        const playerIds = [
          pairing.pairing_player1_id,
          pairing.pairing_player2_id,
          pairing.pairing_player3_id,
          pairing.pairing_player4_id,
        ].filter((id): id is number => id !== null)

        for (const playerId of playerIds) {
          counts.set(playerId, (counts.get(playerId) ?? 0) + 1)
        }
      }
      return counts
    },
  })
}
