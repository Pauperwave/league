// app\composables\league\useLeagueStandingsQuery.ts
// Pinia Colada queries for cross-tournament standings aggregates (ADR-015):
// the league-wide sum standings shown on the league page, and the
// multi-tournament standings used by TournamentRanking. Moved out of the tournament store —
// they used to share its standings ref with the per-tournament standings, an
// implicit coupling between two different pages.
import { compareStandings } from '#shared/utils/standingsSort'
import { calculatePlayerTableScore, resolveTournamentRuleset } from '#shared/utils/roundScoring'
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
 * Sums `round_results.number_of_kills` per player — pulled out of
 * `fetchKillsByPlayer` so the aggregation itself (the part that was
 * actually wrong before, see 2026-07-31 fix) is unit-testable without a
 * Supabase client.
 */
export function aggregateKillsByPlayer(
  results: { player_id: number; number_of_kills: number | null }[]
): Map<number, number> {
  const killsMap = new Map<number, number>()

  for (const r of results) {
    killsMap.set(r.player_id, (killsMap.get(r.player_id) ?? 0) + (r.number_of_kills ?? 0))
  }

  return killsMap
}

/**
 * Kills aren't a `standings` column (recompute-on-read, same pattern as
 * `useEventStandingsQuery`'s single-tournament version) — derived from
 * `round_results.number_of_kills` via each tournament's pairings.
 */
async function fetchKillsByPlayer(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  tournamentIds: number[]
): Promise<Map<number, number>> {
  const { data: pairingsData, error: pairingsError } = await supabase
    .from('pairings')
    .select('pairing_id')
    .in('tournament_id', tournamentIds)

  if (pairingsError) throw pairingsError

  const pairingIds = (pairingsData ?? []).map(p => p.pairing_id)
  if (!pairingIds.length) return new Map()

  const { data: resultsData, error: resultsError } = await supabase
    .from('round_results')
    .select('player_id, number_of_kills')
    .not('number_of_kills', 'is', null)
    .in('pairing_id', pairingIds)

  if (resultsError) throw resultsError

  return aggregateKillsByPlayer(resultsData ?? [])
}

/**
 * Placement points aren't a `standings` column either (same recompute-on-read
 * gap as kills — see 2026-07-31 fix) — resolved per tournament since each one
 * can (in principle) sit under a different ruleset, same as
 * `useEventStandingsQuery`'s single-tournament version.
 */
async function fetchPlacementPointsByPlayer(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  tournamentIds: number[]
): Promise<Map<number, number>> {
  const placementPointsMap = new Map<number, number>()

  await Promise.all(tournamentIds.map(async (tournamentId) => {
    const { data: pairingsData, error: pairingsError } = await supabase
      .from('pairings')
      .select('pairing_id, round_results (*)')
      .eq('tournament_id', tournamentId)

    if (pairingsError) throw pairingsError
    if (!pairingsData?.length) return

    const { posValues, ruleset } = await resolveTournamentRuleset(supabase, tournamentId)

    for (const pairing of pairingsData) {
      const tableResults = pairing.round_results ?? []
      for (const result of tableResults) {
        const scored = calculatePlayerTableScore(result.player_id, tableResults, posValues, ruleset)
        if (!scored) continue
        placementPointsMap.set(result.player_id, (placementPointsMap.get(result.player_id) ?? 0) + scored.scoreRank)
      }
    }
  }))

  return placementPointsMap
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
 * recomputed kill counts, then applies the shared tie-break sort. Pulled out
 * of `useLeagueStandingsQuery` so the actual summing logic — the part that
 * silently dropped kills before the 2026-07-31 fix — is unit-testable
 * without a Supabase client.
 */
export function aggregateLeagueStandings(
  rows: LeagueStandingRow[],
  killsMap: Map<number, number>,
  placementPointsMap: Map<number, number>
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
      playerMap.set(s.player_id, {
        standing_id: 0,
        tournament_id: null,
        player_id: s.player_id,
        standing_player_score: s.standing_player_score ?? 0,
        standing_player_rank: null,
        victories: s.victories ?? 0,
        kills: killsMap.get(s.player_id) ?? 0,
        placementPoints: placementPointsMap.get(s.player_id) ?? 0,
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

      const [standingsData, killsMap, placementPointsMap] = await Promise.all([
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
        fetchKillsByPlayer(supabase, tournamentIds),
        fetchPlacementPointsByPlayer(supabase, tournamentIds),
      ])

      return aggregateLeagueStandings(standingsData ?? [], killsMap, placementPointsMap)
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

      const [{ data, error }, killsMap, placementPointsMap] = await Promise.all([
        supabase
          .from('standings')
          .select(`
            *,
            players:player_id (player_id, player_name, player_surname)
          `)
          .in('tournament_id', ids),
        fetchKillsByPlayer(supabase, ids),
        fetchPlacementPointsByPlayer(supabase, ids),
      ])

      if (error) throw error

      return (data ?? []).map(s => ({
        ...s,
        kills: killsMap.get(s.player_id) ?? 0,
        placementPoints: placementPointsMap.get(s.player_id) ?? 0,
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
