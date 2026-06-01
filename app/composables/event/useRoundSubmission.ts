import type { RoundResultInsert } from '#shared/utils/types'

/**
 * Composable per gestire la sottomissione dei risultati del round.
 * Integra rankingsStore e killsStore con il database.
 */
export function useRoundSubmission() {
  const rankingsStore = useRankingsStore()
  const killsStore = useKillsStore()
  const eventStore = useEventStore()

  /**
   * Converte i dati degli store in RoundResultInsert per il database
   */
  function prepareRoundResults(pairingId: number, playerIds: number[]): RoundResultInsert[] {
    const rankingWithRanks = rankingsStore.getRankingWithRanks(pairingId)
    const kills = killsStore.kills

    if (!rankingWithRanks) return []

    return playerIds.map((playerId) => {
      const entry = rankingWithRanks.find(r => r.playerId === playerId)
      const position = entry?.rank ?? 0

      // Calcola il numero di kill per questo giocatore
      const numberOfKills = kills.filter((k) => k.killerId === playerId).length

      return {
        player_id: playerId,
        pairing_id: pairingId,
        position,
        number_of_kills: numberOfKills,
        brew_vote: null,
        play_vote_1: null,
        play_vote_2: null,
        commander_1: null,
        commander_2: null,
      }
    })
  }

  /**
   * Sottomette i risultati del round al database
   */
  async function submitRoundResults(pairingId: number, playerIds: number[]): Promise<{ success: boolean; error?: string }> {
    try {
      const roundResults = prepareRoundResults(pairingId, playerIds)

      for (const result of roundResults) {
        await eventStore.submitRoundResult(result)
      }

      return { success: true }
    }
    catch (err) {
      console.error('[useRoundSubmission] submitRoundResults error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Errore nella sottomissione dei risultati' }
    }
  }

  /**
   * Aggiorna i risultati di un round esistente
   */
  async function updateRoundResults(pairingId: number, playerIds: number[]): Promise<{ success: boolean; error?: string }> {
    try {
      const roundResults = prepareRoundResults(pairingId, playerIds)

      for (const result of roundResults) {
        await eventStore.updateRoundResult(pairingId, result.player_id, result)
      }

      return { success: true }
    }
    catch (err) {
      console.error('[useRoundSubmission] updateRoundResults error:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Errore nell\'aggiornamento dei risultati' }
    }
  }

  return {
    prepareRoundResults,
    submitRoundResults,
    updateRoundResults,
  }
}
