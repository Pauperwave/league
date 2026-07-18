// app\composables\league\useLeagueStandingsQuery.ts
// Pinia Colada queries for cross-event standings aggregates (ADR-015):
// the league-wide sum standings shown on the league page, and the
// multi-event standings used by EventRanking. Moved out of the event store —
// they used to share its standings ref with the per-event standings, an
// implicit coupling between two different pages.
import type { StandingWithPlayer, Player } from '#shared/utils/types'
import type { Database } from '#shared/utils/types/database'

async function fetchStandingsForEvents<T>(
  supabase: ReturnType<typeof useSupabaseClient<Database>>,
  eventIds: number[],
  selectColumns: string
): Promise<T[]> {
  // selectColumns is a dynamic string, so Supabase can't statically type the
  // response shape — callers pass T to describe the columns they selected.
  const { data, error } = await supabase
    .from('standings')
    .select(selectColumns)
    .in('event_id', eventIds)

  if (error) throw error
  return (data ?? []) as unknown as T[]
}

/** Query key for a league's summed standings. */
export const LEAGUE_STANDINGS_KEY = ['league-standings']

/** Simple sum aggregation of standings across all of a league's events. */
export function useLeagueStandingsQuery(leagueId: number) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: [...LEAGUE_STANDINGS_KEY, leagueId],
    query: async (): Promise<StandingWithPlayer[]> => {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('event_id')
        .eq('league_id', leagueId)

      if (eventsError) throw eventsError
      if (!eventsData?.length) return []

      const eventIds = eventsData.map(e => e.event_id)

      interface LeagueStandingRow {
        player_id: number
        standing_player_score: number | null
        victories: number | null
        brew_received: number | null
        play_received: number | null
        players: Pick<Player, 'player_id' | 'player_name' | 'player_surname' | 'formats_played' | 'is_active'> | null
      }

      const standingsData = await fetchStandingsForEvents<LeagueStandingRow>(
        supabase,
        eventIds,
        `
          player_id,
          standing_player_score,
          victories,
          brew_received,
          play_received,
          players:player_id (player_id, player_name, player_surname, formats_played, is_active)
        `
      )

      const playerMap = new Map<number, StandingWithPlayer>()

      for (const s of standingsData ?? []) {
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
            event_id: null,
            player_id: s.player_id,
            standing_player_score: s.standing_player_score ?? 0,
            standing_player_rank: null,
            victories: s.victories ?? 0,
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

      return Array.from(playerMap.values()).sort(
        (a, b) => (b.standing_player_score ?? 0) - (a.standing_player_score ?? 0)
      )
    },
  })
}

/** Standings across a specific set of events (EventRanking's cross-event view). */
export function useMultipleEventStandingsQuery(eventIds: MaybeRefOrGetter<number[]>) {
  const supabase = useSupabaseClient()

  return useQuery({
    key: () => ['event-standings-multi', toValue(eventIds).join(',')],
    query: async (): Promise<StandingWithPlayer[]> => {
      const ids = toValue(eventIds)
      if (!ids.length) return []

      const { data, error } = await supabase
        .from('standings')
        .select(`
          *,
          players:player_id (player_id, player_name, player_surname)
        `)
        .in('event_id', ids)

      if (error) throw error

      return (data ?? []).map(s => ({
        ...s,
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
