// app\composables\event\usePlayerDisplay.ts
import type { TournamentPlayer } from '#shared/utils/types'

export function usePlayerDisplay() {
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
    playerDisplayName,
  }
}
