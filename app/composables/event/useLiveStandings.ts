// app\composables\event\useLiveStandings.ts
import type { Ref } from 'vue'
import { getPairingPlayerIds } from '#shared/utils/types'
import type { StandingWithPlayer, PairingWithResults, EventStatus } from '#shared/utils/types'
import type { RankingEntry } from '~/stores/rankings'

interface RulesetValues {
  rule_set_rank1: number
  rule_set_rank2: number
  rule_set_rank3: number
  rule_set_rank4: number
  rule_set_kill: number
  rule_set_brew: number
  rule_set_play: number
}

interface StandingWithDefaults extends StandingWithPlayer {
  standing_player_score: number
  victories: number
  kills: number
  brew_received: number
  play_received: number
}

interface PlayerTableScore {
  totalScore: number
  position: number
  numberOfKills: number
  brewVote: number
  totalPlayCount: number
}

export function buildPosValues(r: RulesetValues): number[] {
  return [0, r.rule_set_rank1 ?? 0, r.rule_set_rank2 ?? 0, r.rule_set_rank3 ?? 0, r.rule_set_rank4 ?? 0]
}

export function cloneStandings(base: StandingWithPlayer[]): StandingWithDefaults[] {
  return base.map(s => ({
    ...s,
    standing_player_score: s.standing_player_score ?? 0,
    victories: s.victories ?? 0,
    kills: s.kills ?? 0,
    brew_received: s.brew_received ?? 0,
    play_received: s.play_received ?? 0,
  }))
}

export function calculatePlayerTableScore(
  playerId: number,
  playerIds: number[],
  posValues: number[],
  ranking: RankingEntry[] | null,
  tableKills: { killerId: number; victimId: number }[],
  r: RulesetValues,
  getDeckVote: (playerId: number) => number | null,
  getPlayVote: (playerId: number) => number | null,
): PlayerTableScore {
  const rankEntry = ranking?.find(rk => rk.playerId === playerId)
  const position = rankEntry?.rank ?? 0

  const numberOfKills = tableKills.filter(k => k.killerId === playerId).length

  const otherPlayerIds = playerIds.filter(id => id !== playerId)
  const brewVote = otherPlayerIds.filter(id => getDeckVote(id) === playerId).length
  const totalPlayCount = otherPlayerIds.filter(id => getPlayVote(id) === playerId).length

  let scoreRank = 0
  if (ranking && position !== 0) {
    const samePositionCount = ranking.filter(rk => rk.rank === position).length
    const rankSum = Array.from({ length: samePositionCount }, (_, i) =>
      posValues[Math.min(position + i, 4)] ?? 0,
    ).reduce((a, b) => a + b, 0)
    scoreRank = Math.floor(rankSum / samePositionCount)
  }

  const totalScore = scoreRank
    + numberOfKills * (r.rule_set_kill ?? 0)
    + brewVote * (r.rule_set_brew ?? 0)
    + totalPlayCount * (r.rule_set_play ?? 0)

  return { totalScore, position, numberOfKills, brewVote, totalPlayCount }
}

export function updateStanding(
  result: StandingWithDefaults[],
  playerId: number,
  score: PlayerTableScore,
): void {
  const standing = result.find(s => s.player_id === playerId)
  if (!standing) return

  standing.standing_player_score += score.totalScore
  standing.victories += score.position === 1 ? 1 : 0
  standing.kills += score.numberOfKills
  standing.brew_received += score.brewVote
  standing.play_received += score.totalPlayCount
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

    const posValues = buildPosValues(r)
    const result = cloneStandings(standings.value)

    for (const pairing of pairings.value) {
      const playerIds = getPairingPlayerIds(pairing)
      if (playerIds.length === 0) continue

      const ranking = rankingsStore.getRankingWithRanks(pairing.pairing_id)
      const hasRanking = !!ranking && ranking.length > 0

      const tableKills = killsStore.kills.filter((k) =>
        playerIds.includes(k.killerId) && playerIds.includes(k.victimId),
      )

      for (const playerId of playerIds) {
        const score = calculatePlayerTableScore(
          playerId,
          playerIds,
          posValues,
          hasRanking ? ranking : null,
          tableKills,
          r,
          votesStore.getDeckVote,
          votesStore.getPlayVote,
        )

        updateStanding(result, playerId, score)
      }
    }

    return result.sort((a, b) => (b.standing_player_score || 0) - (a.standing_player_score || 0))
  })

  return { liveStandings }
}
