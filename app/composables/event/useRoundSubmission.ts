// app\composables\event\useRoundSubmission.ts
import { useI18n } from 'vue-i18n'
import type { RoundResultInsert } from '#shared/utils/types'

/**
 * Composable for handling round result submission.
 * Integrates rankingsStore and killsStore with the database.
 */
export function useRoundSubmission() {
  const rankingsStore = useRankingsStore()
  const killsStore = useKillsStore()
  const eventStore = useEventStore()
  const { t } = useI18n()

  /**
   * Converts store data into RoundResultInsert for the database
   */
  function prepareRoundResults(pairingId: number, playerIds: number[]): RoundResultInsert[] {
    const rankingWithRanks = rankingsStore.getRankingWithRanks(pairingId)
    const kills = killsStore.kills

    if (!rankingWithRanks) return []

    return playerIds.map((playerId) => {
      const entry = rankingWithRanks.find(r => r.playerId === playerId)
      const position = entry?.rank ?? 0

      // Calculate the number of kills for this player
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
   * Submits the round results to the database
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
      return { success: false, error: err instanceof Error ? err.message : t('store.event.submissionError') }
    }
  }

  /**
   * Updates the results of an existing round
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
      return { success: false, error: err instanceof Error ? err.message : t('store.event.resultsUpdateError') }
    }
  }

  return {
    prepareRoundResults,
    submitRoundResults,
    updateRoundResults,
  }
}
