// app\composables\tournament\useTournamentAwards.ts
import type { StandingWithPlayer } from '#shared/utils/types'

export type TournamentAwardKind = 'victim' | 'killer' | 'brewer' | 'player'

export interface TournamentAward {
  kind: TournamentAwardKind
  playerId: number
  playerName: string
  playerSurname: string
  value: number
}

/**
 * End-of-tournament "highlight" awards shown alongside the final standings
 * (StandingsCard): most-killed ("Vittima"), most kills dealt ("Carnefice"),
 * best brew-vote score ("Master Brewer"), best play-vote count ("Il Player").
 * Each is the single highest scorer for its stat — ties are broken by
 * whichever player sorts first in `standings`, same as everywhere else in the
 * app that doesn't have a dedicated tie-break rule. An award is omitted
 * entirely when its stat is 0 for everyone (e.g. a tournament with no kills
 * logged yet), rather than crowning an arbitrary 0.
 */
export function useTournamentAwards(
  standings: Ref<StandingWithPlayer[]>,
  victimCounts: Ref<Map<number, number>>
) {
  return computed<TournamentAward[]>(() => {
    const pick = (
      kind: TournamentAwardKind,
      getValue: (standing: StandingWithPlayer) => number
    ): TournamentAward | null => {
      let best: TournamentAward | null = null
      for (const standing of standings.value) {
        const value = getValue(standing)
        if (value <= 0 || (best && value <= best.value)) continue
        if (!standing.players) continue
        best = {
          kind,
          playerId: standing.player_id,
          playerName: standing.players.player_name,
          playerSurname: standing.players.player_surname,
          value,
        }
      }
      return best
    }

    return [
      pick('victim', s => victimCounts.value.get(s.player_id) ?? 0),
      pick('killer', s => s.kills ?? 0),
      pick('brewer', s => s.brewPoints ?? 0),
      pick('player', s => s.play_received ?? 0),
    ].filter((award): award is TournamentAward => award !== null)
  })
}
