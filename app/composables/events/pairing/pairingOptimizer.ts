// Greedy + local-swap pairing optimizer with hard constraints and transparent scoring details.
import type { PairingForbiddenPair, PairingWeights, TournamentPlayer, Seat, TournamentTable } from '#shared/utils/types'
import { useTableCalculator } from '../../tables/useTableCalculator'

export type { TournamentPlayer, Seat, TournamentTable, PairingForbiddenPair, PairingWeights }

export interface PairingPlayerScore {
  playerId: number
  strengthBalance: number
  novelty: number
  rematchPenalty: number
  rotateTable3: number
  tableSizeWeight: number
  total: number
}

export interface PairingPlayer {
  id: number
  rank: number
  score: number
  table3Count: number
}

export interface PairingHistoryEntry {
  round: number
  players: number[]
}

export interface PairingTableScore {
  strengthBalance: number
  novelty: number
  rematchPenalty: number
  rotateTable3: number
  tableSizeWeight: number
  total: number
  players: PairingPlayerScore[]
}

export interface PairingOptimizerResult {
  tables: number[][]
  totalScore: number
  tableScores: PairingTableScore[]
}

export interface PairingScoreDetails {
  totalScore: number
  tableScores: PairingTableScore[]
  isValid: boolean
}

export const DEFAULT_PAIRING_WEIGHTS: PairingWeights = {
  strengthBalance: 1,
  novelty: 1.2,
  rematch: 1.4,
  rotateTable3: 1,
  tableSize4: 0.15,
  tableSize3: -0.15,
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function buildForbiddenSet(pairs: PairingForbiddenPair[]): Set<string> {
  const set = new Set<string>()
  for (const pair of pairs) {
    if (pair.playerA === pair.playerB) continue
    set.add(pairKey(pair.playerA, pair.playerB))
  }
  return set
}

function buildRematchMap(history: PairingHistoryEntry[]): Map<string, { count: number, lastRound: number }> {
  const map = new Map<string, { count: number, lastRound: number }>()

  for (const entry of history) {
    const players = entry.players
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const left = players[i]
        const right = players[j]
        if (left === undefined || right === undefined) continue

        const key = pairKey(left, right)
        const current = map.get(key)
        if (!current) {
          map.set(key, { count: 1, lastRound: entry.round })
          continue
        }

        map.set(key, {
          count: current.count + 1,
          lastRound: Math.max(current.lastRound, entry.round),
        })
      }
    }
  }

  return map
}

function hasForbiddenConflict(table: number[], forbiddenSet: Set<string>): boolean {
  for (let i = 0; i < table.length; i++) {
    for (let j = i + 1; j < table.length; j++) {
      const left = table[i]
      const right = table[j]
      if (left === undefined || right === undefined) continue

      if (forbiddenSet.has(pairKey(left, right))) {
        return true
      }
    }
  }
  return false
}

function scoreTable(
  table: number[],
  playersById: Map<number, PairingPlayer>,
  rematchMap: Map<string, { count: number, lastRound: number }>,
  currentRound: number,
  weights: PairingWeights
): PairingTableScore {
  let strengthSpreadPenalty = 0
  let novelty = 0
  let rematchPenalty = 0
  let rotateTable3 = 0

  const size = table.length
  const tableSizeWeight = size === 4 ? weights.tableSize4 : weights.tableSize3
  const perPlayer = new Map<number, PairingPlayerScore>()

  for (const playerId of table) {
    perPlayer.set(playerId, {
      playerId,
      strengthBalance: 0,
      novelty: 0,
      rematchPenalty: 0,
      rotateTable3: 0,
      tableSizeWeight: 0,
      total: 0,
    })
  }

  const ranks = table
    .map(id => playersById.get(id)?.rank ?? 9999)
    .sort((a, b) => a - b)

  if (ranks.length > 1) {
    const minRank = ranks[0] ?? 0
    const maxRank = ranks[ranks.length - 1] ?? 0
    strengthSpreadPenalty = maxRank - minRank
  }

  const strengthTotal = -strengthSpreadPenalty * weights.strengthBalance
  const rankByPlayer = new Map<number, number>(
    table.map(playerId => [playerId, playersById.get(playerId)?.rank ?? 9999])
  )

  if (table.length > 0) {
    const avgRank = table.reduce((acc, playerId) => acc + (rankByPlayer.get(playerId) ?? 9999), 0) / table.length
    const deviations = table.map(playerId => ({
      playerId,
      deviation: Math.abs((rankByPlayer.get(playerId) ?? avgRank) - avgRank),
    }))
    const totalDeviation = deviations.reduce((acc, item) => acc + item.deviation, 0)

    for (const item of deviations) {
      const share = totalDeviation > 0
        ? (item.deviation / totalDeviation) * strengthTotal
        : strengthTotal / table.length

      const playerScore = perPlayer.get(item.playerId)
      if (!playerScore) continue
      playerScore.strengthBalance += share
    }
  }

  if (size === 3) {
    rotateTable3 = table.reduce((acc, playerId) => {
      const player = playersById.get(playerId)
      return acc + (player?.table3Count ?? 0)
    }, 0)

    for (const playerId of table) {
      const playerScore = perPlayer.get(playerId)
      if (!playerScore) continue

      const table3Count = playersById.get(playerId)?.table3Count ?? 0
      playerScore.rotateTable3 -= table3Count * weights.rotateTable3
    }
  }

  for (let i = 0; i < table.length; i++) {
    for (let j = i + 1; j < table.length; j++) {
      const left = table[i]
      const right = table[j]
      if (left === undefined || right === undefined) continue

      const key = pairKey(left, right)
      const rematch = rematchMap.get(key)
      if (!rematch) {
        novelty += 1
        const leftScore = perPlayer.get(left)
        const rightScore = perPlayer.get(right)
        if (leftScore) leftScore.novelty += weights.novelty / 2
        if (rightScore) rightScore.novelty += weights.novelty / 2
        continue
      }

      const roundsAgo = Math.max(1, currentRound - rematch.lastRound)
      const recencyFactor = 1 / roundsAgo
      rematchPenalty += rematch.count + recencyFactor

      const penaltyValue = -(rematch.count + recencyFactor) * weights.rematch / 2
      const leftScore = perPlayer.get(left)
      const rightScore = perPlayer.get(right)
      if (leftScore) leftScore.rematchPenalty += penaltyValue
      if (rightScore) rightScore.rematchPenalty += penaltyValue
    }
  }

  const tableSizePerPlayer = table.length > 0 ? tableSizeWeight / table.length : 0
  for (const playerId of table) {
    const playerScore = perPlayer.get(playerId)
    if (!playerScore) continue

    playerScore.tableSizeWeight += tableSizePerPlayer
    playerScore.total =
      playerScore.strengthBalance
      + playerScore.novelty
      + playerScore.rematchPenalty
      + playerScore.rotateTable3
      + playerScore.tableSizeWeight
  }

  const total =
    strengthTotal
    + novelty * weights.novelty
    - rematchPenalty * weights.rematch
    - rotateTable3 * weights.rotateTable3
    + tableSizeWeight

  return {
    strengthBalance: -strengthSpreadPenalty * weights.strengthBalance,
    novelty: novelty * weights.novelty,
    rematchPenalty: -rematchPenalty * weights.rematch,
    rotateTable3: -rotateTable3 * weights.rotateTable3,
    tableSizeWeight,
    total,
    players: table.map(playerId => perPlayer.get(playerId)).filter((entry): entry is PairingPlayerScore => entry !== undefined),
  }
}

function scoreSolution(
  tables: number[][],
  playersById: Map<number, PairingPlayer>,
  rematchMap: Map<string, { count: number, lastRound: number }>,
  forbiddenSet: Set<string>,
  currentRound: number,
  weights: PairingWeights
): PairingOptimizerResult {
  const tableScores: PairingTableScore[] = []
  let totalScore = 0

  for (const table of tables) {
    if (hasForbiddenConflict(table, forbiddenSet)) {
      return {
        tables,
        totalScore: Number.NEGATIVE_INFINITY,
        tableScores: [],
      }
    }

    const score = scoreTable(table, playersById, rematchMap, currentRound, weights)
    tableScores.push(score)
    totalScore += score.total
  }

  return {
    tables,
    totalScore,
    tableScores,
  }
}

export function scorePairingTables(params: {
  tables: number[][]
  players: PairingPlayer[]
  history: PairingHistoryEntry[]
  forbiddenPairs: PairingForbiddenPair[]
  weights?: Partial<PairingWeights>
  currentRound: number
}): PairingScoreDetails {
  const weights: PairingWeights = {
    ...DEFAULT_PAIRING_WEIGHTS,
    ...(params.weights ?? {}),
  }

  const playersById = new Map(params.players.map(p => [p.id, p]))
  const rematchMap = buildRematchMap(params.history)
  const forbiddenSet = buildForbiddenSet(params.forbiddenPairs)

  const result = scoreSolution(
    params.tables,
    playersById,
    rematchMap,
    forbiddenSet,
    params.currentRound,
    weights
  )

  return {
    totalScore: result.totalScore,
    tableScores: result.tableScores,
    isValid: Number.isFinite(result.totalScore),
  }
}

function removeAt<T>(arr: T[], index: number): T {
  const value = arr[index]
  if (value === undefined) {
    throw new Error('Invalid removeAt index')
  }
  arr.splice(index, 1)
  return value
}

function buildGreedyTables(
  orderedPlayers: PairingPlayer[],
  playersById: Map<number, PairingPlayer>,
  rematchMap: Map<string, { count: number, lastRound: number }>,
  forbiddenSet: Set<string>,
  currentRound: number,
  weights: PairingWeights,
  tableSizes: number[]
): number[][] {
  const playerPool = [...orderedPlayers]
  const tables: number[][] = []

  for (const size of tableSizes) {
    if (!playerPool.length) break

    const seed = removeAt(playerPool, 0)
    const table = [seed.id]

    while (table.length < size && playerPool.length) {
      let bestIndex = -1
      let bestScore = Number.NEGATIVE_INFINITY

      for (let i = 0; i < playerPool.length; i++) {
        const candidate = playerPool[i]
        if (!candidate) continue
        const nextTable = [...table, candidate.id]
        if (hasForbiddenConflict(nextTable, forbiddenSet)) continue

        const partialScore = scoreTable(nextTable, playersById, rematchMap, currentRound, weights).total
        if (partialScore > bestScore) {
          bestScore = partialScore
          bestIndex = i
        }
      }

      if (bestIndex === -1) {
        const fallback = removeAt(playerPool, 0)
        table.push(fallback.id)
      }
      else {
        const picked = removeAt(playerPool, bestIndex)
        table.push(picked.id)
      }
    }

    tables.push(table)
  }

  return tables
}

function cloneTables(tables: number[][]): number[][] {
  return tables.map(table => [...table])
}

function improveBySwap(
  initialTables: number[][],
  playersById: Map<number, PairingPlayer>,
  rematchMap: Map<string, { count: number, lastRound: number }>,
  forbiddenSet: Set<string>,
  currentRound: number,
  weights: PairingWeights,
  timeBudgetMs: number
): PairingOptimizerResult {
  const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now()
  const started = now()
  let best = scoreSolution(initialTables, playersById, rematchMap, forbiddenSet, currentRound, weights)
  let working = cloneTables(initialTables)

  for (let t1 = 0; t1 < working.length; t1++) {
    for (let t2 = t1 + 1; t2 < working.length; t2++) {
      const table1 = working[t1]
      const table2 = working[t2]
      if (!table1 || !table2) continue

      for (let i = 0; i < table1.length; i++) {
        for (let j = 0; j < table2.length; j++) {
          if ((now() - started) >= timeBudgetMs) {
            return best
          }

          const candidate = cloneTables(working)
          const c1 = candidate[t1]
          const c2 = candidate[t2]
          if (!c1 || !c2) continue

          const left = c1[i]
          const right = c2[j]
          if (left === undefined || right === undefined) continue

          c1[i] = right
          c2[j] = left

          const scored = scoreSolution(candidate, playersById, rematchMap, forbiddenSet, currentRound, weights)
          if (scored.totalScore > best.totalScore) {
            best = scored
            working = cloneTables(candidate)
          }
        }
      }
    }
  }

  return best
}

export function optimizePairings(params: {
  players: PairingPlayer[]
  history: PairingHistoryEntry[]
  forbiddenPairs: PairingForbiddenPair[]
  weights?: Partial<PairingWeights>
  currentRound: number
  swapTimeBudgetMs?: number
}): PairingOptimizerResult {
  const { players, history, forbiddenPairs, currentRound } = params
  const swapTimeBudgetMs = params.swapTimeBudgetMs ?? 120
  const { getTableSizes } = useTableCalculator()

  const weights: PairingWeights = {
    ...DEFAULT_PAIRING_WEIGHTS,
    ...(params.weights ?? {}),
  }

  const playersById = new Map(players.map(p => [p.id, p]))
  const forbiddenSet = buildForbiddenSet(forbiddenPairs)
  const rematchMap = buildRematchMap(history)
  const tableSizes = getTableSizes(players.length)

  const orderByRank = [...players].sort((a, b) => a.rank - b.rank)
  const orderByTable3Need = [...players].sort((a, b) => a.table3Count - b.table3Count || a.rank - b.rank)
  const orderByScore = [...players].sort((a, b) => b.score - a.score)
  const attempts = [orderByRank, orderByTable3Need, orderByScore]

  let best: PairingOptimizerResult = {
    tables: tableSizes.map(() => []),
    totalScore: Number.NEGATIVE_INFINITY,
    tableScores: [],
  }

  for (const attempt of attempts) {
    const greedyTables = buildGreedyTables(
      attempt,
      playersById,
      rematchMap,
      forbiddenSet,
      currentRound,
      weights,
      tableSizes
    )

    const improved = improveBySwap(
      greedyTables,
      playersById,
      rematchMap,
      forbiddenSet,
      currentRound,
      weights,
      Math.max(30, Math.floor(swapTimeBudgetMs / attempts.length))
    )

    if (improved.totalScore > best.totalScore) {
      best = improved
    }
  }

  return best
}

export function getForbiddenPairKey(playerA: number, playerB: number): string {
  return pairKey(playerA, playerB)
}
