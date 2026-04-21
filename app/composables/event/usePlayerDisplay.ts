import type { TournamentPlayer } from '#shared/utils/types'

export function usePlayerDisplay() {
  function playerInitial(player: TournamentPlayer): string {
    return player.name.trim().charAt(0).toUpperCase() || '?'
  }

  function playerDisplayName(player: TournamentPlayer): { name: string; surname: string } {
    const normalizedSurname = player.surname.trim()
    const fullName = player.name.trim()
    const fullNameLower = fullName.toLowerCase()
    const surnameLower = normalizedSurname.toLowerCase()

    if (fullNameLower.endsWith(surnameLower)) {
      const splitIndex = fullName.length - normalizedSurname.length
      return {
        name: fullName.slice(0, splitIndex).trim(),
        surname: normalizedSurname,
      }
    }

    return {
      name: fullName,
      surname: normalizedSurname,
    }
  }

  return {
    playerInitial,
    playerDisplayName,
  }
}
