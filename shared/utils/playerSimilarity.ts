import levenshtein from 'fast-levenshtein'
import type { Player } from './types'

/**
 * Calcola la similarità tra due stringhe usando Levenshtein.
 * Ritorna un valore tra 0 (diversi) e 1 (identici).
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
 * Trova giocatori simili dati nome e cognome.
 * Usa una soglia combinata ponderata (cognome pesa di più).
 * Ritorna max 3 risultati ordinati per similarità.
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
      // Media ponderata: cognome pesa di più (0.6) perché è più discriminante
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
 * Verifica se un nome/cognome è abbastanza distinto dai giocatori esistenti.
 * Utile per abilitare/disabilitare il bottone di creazione.
 */
export function isPlayerNameDistinct(
  players: Player[],
  firstName: string,
  lastName: string,
  threshold = 0.6
): boolean {
  return findSimilarPlayers(players, firstName, lastName, threshold).length === 0
}
