import type { EventStatus } from '#shared/utils/types'

export function isLastRoundState(eventStatus: EventStatus, currentRound: number, totalRounds: number): boolean {
  return eventStatus === 'playing' && currentRound >= totalRounds && totalRounds > 0
}

export function getStandingsTitle(eventStatus: EventStatus, currentRound: number): string {
  if (eventStatus === 'ended') return 'Classifica Finale'
  if (currentRound > 0) return `Classifica Round ${currentRound}`
  return 'Classifica'
}
