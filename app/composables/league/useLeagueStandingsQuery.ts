// app\composables\league\useLeagueStandingsQuery.ts
// Pinia Colada queries for cross-tournament standings aggregates (ADR-015):
// the league-wide sum standings shown on the league page, and the
// multi-tournament standings used by TournamentRanking. Moved out of the tournament store —
// they used to share its standings ref with the per-tournament standings, an
// implicit coupling between two different pages.
import { compareStandings } from '#shared/utils/standingsSort'
import { aggregatePointBreakdowns, resolveTournamentRuleset } from '#shared/utils/roundScoring'
import type { PlayerPointBreakdown } from '#shared/utils/roundScoring'
import type { StandingWithPlayer, Player } from '#shared/utils/types'
import type { Database } from '#shared/utils/types/database'

async function fetchStandingsForTournaments<T>(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  tournamentIds: number[],
  selectColumns: string
): Promise<T[]> {
  // selectColumns is a dynamic string, so Supabase can't statically type the
  // response shape — callers pass T to describe the columns they selected.
  const { data, error } = await supabase
    .from('standings')
    .select(selectColumns)
    .in('tournament_id', tournamentIds)

  if (error) throw error
  return (data ?? []) as unknown as T[]
}

/**
 * Sums per-tournament PlayerPointBreakdowns into one entry per player —
 * pulled out of `fetchPointBreakdownsByPlayer` so the summing itself is
 * unit-testable without a Supabase client.
 */
export function sumPointBreakdowns(
  perTournament: Map<number, PlayerPointBreakdown>[]
): Map<number, PlayerPointBreakdown> {
  const summed = new Map<number, PlayerPointBreakdown>()

  for (const tournamentMap of perTournament) {
    for (const [playerId, breakdown] of tournamentMap) {
      const existing = summed.get(playerId)
      if (existing) {
        existing.kills += breakdown.kills
        existing.placementPoints += breakdown.placementPoints
        existing.killPoints += breakdown.killPoints
        existing.brewPoints += breakdown.brewPoints
        existing.playPoints += breakdown.playPoints
      }
      else {
        summed.set(playerId, { ...breakdown })
      }
    }
  }

  return summed
}

/**
 * Kills/placement/victory/brew/play points aren't `standings` columns
 * (recompute-on-read, same pattern as `useEventStandingsQuery`'s
 * single-tournament version) — resolved per tournament since each one can
 * (in principle) sit under a different ruleset, then summed across the set.
 */
async function fetchPointBreakdownsByPlayer(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  tournamentIds: number[]
): Promise<Map<number, PlayerPointBreakdown>> {
  const perTournament = await Promise.all(tournamentIds.map(async (tournamentId) => {
    const { data: pairingsData, error: pairingsError } = await supabase
      .from('pairings')
      .select('pairing_id, round_results (*)')
      .eq('tournament_id', tournamentId)

    if (pairingsError) throw pairingsError
    if (!pairingsData?.length) return new Map<number, PlayerPointBreakdown>()

    const { posValues, ruleset } = await resolveTournamentRuleset(supabase, tournamentId)
    return aggregatePointBreakdowns(pairingsData, posValues, ruleset)
  }))

  return sumPointBreakdowns(perTournament)
}

/** Row shape selected by `useLeagueStandingsQuery`'s `standings` query — exported for its aggregation test. */
export interface LeagueStandingRow {
  player_id: number
  standing_player_score: number | null
  victories: number | null
  brew_received: number | null
  play_received: number | null
  players: Pick<Player, 'player_id' | 'player_name' | 'player_surname' | 'formats_played' | 'is_active'> | null
}

/**
 * Sums per-tournament `standings` rows into one row per player (a player who
 * appears in N tournaments gets one summed entry) and merges in the
 * recomputed point breakdown, then applies the shared tie-break sort. Pulled
 * out of `useLeagueStandingsQuery` so the actual summing logic — the part
 * that silently dropped kills/placementPoints before the 2026-07-31 fixes —
 * is unit-testable without a Supabase client.
 */
export function aggregateLeagueStandings(
  rows: LeagueStandingRow[],
  breakdowns: Map<number, PlayerPointBreakdown>
): StandingWithPlayer[] {
  const playerMap = new Map<number, StandingWithPlayer>()

  for (const s of rows) {
    const existing = playerMap.get(s.player_id)
    if (existing) {
      existing.standing_player_score = (existing.standing_player_score ?? 0) + (s.standing_player_score ?? 0)
      existing.victories = (existing.victories ?? 0) + (s.victories ?? 0)
      existing.brew_received = (existing.brew_received ?? 0) + (s.brew_received ?? 0)
      existing.play_received = (existing.play_received ?? 0) + (s.play_received ?? 0)
    }
    else {
      const breakdown = breakdowns.get(s.player_id)
      playerMap.set(s.player_id, {
        standing_id: 0,
        tournament_id: null,
        player_id: s.player_id,
        standing_player_score: s.standing_player_score ?? 0,
        standing_player_rank: null,
        victories: s.victories ?? 0,
        kills: breakdown?.kills ?? 0,
        placementPoints: breakdown?.placementPoints ?? 0,
        killPoints: breakdown?.killPoints ?? 0,
        brewPoints: breakdown?.brewPoints ?? 0,
        playPoints: breakdown?.playPoints ?? 0,
        brew_received: s.brew_received ?? 0,
        play_received: s.play_received ?? 0,
        players: s.players
          ? sanitizePlayer({
            player_id: s.players.player_id,
            player_name: s.players.player_name,
            player_surname: s.players.player_surname,
            formats_played: s.players.formats_played ?? null,
            is_active: s.players.is_active ?? true,
          })
          : undefined,
      })
    }
  }

  return Array.from(playerMap.values()).sort(compareStandings)
}

/** Query key for a league's summed standings. */
export const LEAGUE_STANDINGS_KEY = ['league-standings']

/** Simple sum aggregation of standings across all of a league's tournaments. */
export function useLeagueStandingsQuery(leagueId: number) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: [...LEAGUE_STANDINGS_KEY, leagueId],
    query: async (): Promise<StandingWithPlayer[]> => {
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('tournament_id')
        .eq('league_id', leagueId)

      if (tournamentsError) throw tournamentsError
      if (!tournamentsData?.length) return []

      const tournamentIds = tournamentsData.map(e => e.tournament_id)

      const [standingsData, breakdowns] = await Promise.all([
        fetchStandingsForTournaments<LeagueStandingRow>(
          supabase,
          tournamentIds,
          `
            player_id,
            standing_player_score,
            victories,
            brew_received,
            play_received,
            players:player_id (player_id, player_name, player_surname, formats_played, is_active)
          `
        ),
        fetchPointBreakdownsByPlayer(supabase, tournamentIds),
      ])

      return aggregateLeagueStandings(standingsData ?? [], breakdowns)
    },
  })
}

/** Standings across a specific set of tournaments (TournamentRanking's cross-tournament view). */
export function useMultipleEventStandingsQuery(tournamentIds: MaybeRefOrGetter<number[]>) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: () => ['event-standings-multi', toValue(tournamentIds).join(',')],
    query: async (): Promise<StandingWithPlayer[]> => {
      const ids = toValue(tournamentIds)
      if (!ids.length) return []

      const [{ data, error }, breakdowns] = await Promise.all([
        supabase
          .from('standings')
          .select(`
            *,
            players:player_id (player_id, player_name, player_surname)
          `)
          .in('tournament_id', ids),
        fetchPointBreakdownsByPlayer(supabase, ids),
      ])

      if (error) throw error

      return (data ?? []).map(s => ({
        ...s,
        kills: breakdowns.get(s.player_id)?.kills ?? 0,
        placementPoints: breakdowns.get(s.player_id)?.placementPoints ?? 0,
        killPoints: breakdowns.get(s.player_id)?.killPoints ?? 0,
        brewPoints: breakdowns.get(s.player_id)?.brewPoints ?? 0,
        playPoints: breakdowns.get(s.player_id)?.playPoints ?? 0,
        players: s.players
          ? sanitizePlayer({
            player_id: s.players.player_id,
            player_name: s.players.player_name,
            player_surname: s.players.player_surname,
          }) as Player
          : undefined,
      })) as StandingWithPlayer[]
    },
  })
}
