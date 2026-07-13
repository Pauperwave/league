// shared\utils\playerSimilarity.ts
import levenshtein from 'fast-levenshtein'
import type { Player } from './types'

/**
 * Calculates the similarity between two strings using Levenshtein distance.
 * Returns a value between 0 (different) and 1 (identical).
 */
export function calculateNameSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase()
  const s2 = str2.trim().toLowerCase()

  const maxLen = Math.max(s1.length, s2.length)
  if (maxLen === 0) return 1

  const distance = levenshtein.get(s1, s2)
  return 1 - distance / maxLen
}

interface SimilarPlayer {
  player: Player
  nameSimilarity: number
  surnameSimilarity: number
  combinedSimilarity: number
}

/**
 * Finds similar players given a first and last name.
 * Uses a weighted combined threshold (surname weighs more).
 * Returns at most 3 results ordered by similarity.
 */
export function findSimilarPlayers(
  players: Player[],
  firstName: string,
  lastName: string,
  threshold = 0.6
): SimilarPlayer[] {
  const trimmedFirst = firstName.trim()
  const trimmedLast = lastName.trim()

  if (!trimmedFirst || !trimmedLast) return []

  return players
    .map((player) => {
      const nameSim = calculateNameSimilarity(player.player_name, trimmedFirst)
      const surnameSim = calculateNameSimilarity(player.player_surname, trimmedLast)
      // Weighted average: surname weighs more (0.6) because it's more discriminating
      const combinedSim = nameSim * 0.4 + surnameSim * 0.6

      return {
        player,
        nameSimilarity: nameSim,
        surnameSimilarity: surnameSim,
        combinedSimilarity: combinedSim,
      }
    })
    .filter((result) => result.combinedSimilarity >= threshold)
    .sort((a, b) => b.combinedSimilarity - a.combinedSimilarity)
    .slice(0, 3)
}

/**
 * Checks whether a first/last name is distinct enough from existing players.
 * Useful for enabling/disabling the creation button.
 */
export function isPlayerNameDistinct(
  players: Player[],
  firstName: string,
  lastName: string,
  threshold = 0.6
): boolean {
  return findSimilarPlayers(players, firstName, lastName, threshold).length === 0
}
