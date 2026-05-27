import type { Ref, ComputedRef } from 'vue'
import type { StandingWithPlayer, PairingWithResults, EventStatus } from '#shared/utils/types'

interface RulesetValues {
  rule_set_rank1: number
  rule_set_rank2: number
  rule_set_rank3: number
  rule_set_rank4: number
  rule_set_kill: number
  rule_set_brew: number
  rule_set_play: number
}

export function useLiveStandings(
  rulesetId: Ref<number | null | undefined>,
  eventStatus: Ref<EventStatus>,
  pairings: Ref<PairingWithResults[]>,
  standings: Ref<StandingWithPlayer[]>,
) {
  const supabase = useSupabaseClient()
  const rankingsStore = useRankingsStore()
  const killsStore = useKillsStore()
  const votesStore = useVotesStore()

  const ruleset = ref<RulesetValues | null>(null)

  async function fetchRuleset() {
    const id = rulesetId.value
    if (!id) {
      ruleset.value = null
      return
    }

    const { data } = await supabase
      .from('rulesets')
      .select('rule_set_rank1, rule_set_rank2, rule_set_rank3, rule_set_rank4, rule_set_kill, rule_set_brew, rule_set_play')
      .eq('ruleset_id', id)
      .single()

    ruleset.value = data as RulesetValues | null
  }

  watch(() => rulesetId.value, fetchRuleset, { immediate: true })

  const liveStandings = computed<StandingWithPlayer[]>(() => {
    const r = ruleset.value
    if (!r || eventStatus.value !== 'playing' || pairings.value.length === 0) {
      return standings.value
    }

    const posValues = [
      0,
      r.rule_set_rank1 ?? 0,
      r.rule_set_rank2 ?? 0,
      r.rule_set_rank3 ?? 0,
      r.rule_set_rank4 ?? 0,
    ]

    // Clone standings to avoid mutating the store directly
    const result = standings.value.map(s => ({
      ...s,
      standing_player_score: s.standing_player_score ?? 0,
      victories: s.victories ?? 0,
      brew_received: s.brew_received ?? 0,
      play_received: s.play_received ?? 0,
    }))

    for (const pairing of pairings.value) {
      const playerIds = [
        pairing.pairing_player1_id,
        pairing.pairing_player2_id,
        pairing.pairing_player3_id,
        pairing.pairing_player4_id,
      ].filter((id): id is number => id !== null)

      if (playerIds.length === 0) continue

      const ranking = rankingsStore.getRankingWithRanks(pairing.pairing_id)
      if (!ranking || ranking.length === 0) continue

      const tableKills = killsStore.kills.filter((k) =>
        playerIds.includes(k.killerId) && playerIds.includes(k.victimId),
      )

      // Build per-player data from stores
      for (const playerId of playerIds) {
        const rankEntry = ranking.find(rk => rk.playerId === playerId)
        const position = rankEntry?.rank ?? 0

        const numberOfKills = tableKills.filter(k => k.killerId === playerId).length

        // Votes from everyone else at the table
        const otherPlayerIds = playerIds.filter(id => id !== playerId)
        const brewVote = otherPlayerIds.filter(id => votesStore.getDeckVote(id) === playerId).length
        const totalPlayCount = otherPlayerIds.filter(id => {
          const playVote = votesStore.getPlayVote(id)
          return playVote === playerId
        }).length

        // Tied-position score averaging
        const samePositionCount = position !== 0
          ? ranking.filter(rk => rk.rank === position).length
          : 1

        let rankSum = 0
        for (let i = 0; i < samePositionCount; i++) {
          rankSum += posValues[Math.min(position + i, 4)] ?? 0
        }
        const scoreRank = Math.floor(rankSum / samePositionCount)

        const totalScore = scoreRank
          + numberOfKills * (r.rule_set_kill ?? 0)
          + brewVote * (r.rule_set_brew ?? 0)
          + totalPlayCount * (r.rule_set_play ?? 0)

        const standing = result.find(s => s.player_id === playerId)
        if (standing) {
          standing.standing_player_score += totalScore
          standing.victories += position === 1 ? 1 : 0
          standing.brew_received += brewVote
          standing.play_received += totalPlayCount
        }
      }
    }

    // Sort by score descending
    return result.sort((a, b) => b.standing_player_score - a.standing_player_score)
  })

  return { liveStandings }
}
