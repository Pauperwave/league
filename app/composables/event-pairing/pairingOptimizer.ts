// Greedy + local-swap pairing optimizer with hard constraints and transparent scoring details.
//
// Invariant: for every table, sum(perPlayer[p].total for p in table) === tableScore.total.
// Each weight is applied exactly where its metric is naturally attributable:
//   - strengthBalance is a table-level quantity (rank spread has no single owner), so it's
//     weighted once in calculateStrengthBalance and heuristically redistributed to players.
//   - novelty, rematchPenalty, rotateTable3 are naturally per-pair/per-player (a new pairing
//     belongs to two players, a table3Count belongs to one), so they're weighted once at that
//     attribution point (calculatePairwiseScore / distributeTable3Penalty) AND once more when
//     aggregateTableScore re-weights the raw (unweighted) count for the table-level total.
//   This double application is intentional, not a bug — do not "fix" it by adding the weight
//   to the raw counters (e.g. calculateTable3Penalty) or you will double-weight the metric.
import type { PairingForbiddenPair, PairingWeights, TournamentPlayer, Seat, TournamentTable } from '#shared/utils/types'
import { useTableCalculator } from '../tables/useTableCalculator'

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

// ── Key / lookup helpers ─────────────────────────────────────────────────────

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/** Invoke fn for every unique unordered pair of seats in a table. */
function forEachPair(seats: number[], fn: (left: number, right: number) => void): void {
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const left = seats[i]
      const right = seats[j]
      if (left === undefined || right === undefined) continue
      fn(left, right)
    }
  }
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
    forEachPair(entry.players, (left, right) => {
      const key = pairKey(left, right)
      const current = map.get(key)
      if (!current) {
        map.set(key, { count: 1, lastRound: entry.round })
        return
      }

      map.set(key, {
        count: current.count + 1,
        lastRound: Math.max(current.lastRound, entry.round),
      })
    })
  }

  return map
}

function hasForbiddenConflict(table: number[], forbiddenSet: Set<string>): boolean {
  let hasConflict = false
  forEachPair(table, (left, right) => {
    if (forbiddenSet.has(pairKey(left, right))) hasConflict = true
  })
  return hasConflict
}

// ── Scoring primitives (per-table, per-player) ────────────────────────────────

/**
 * Calculates the strength balance for a table.
 *
 * Measures how evenly matched players are by their tournament rank.
 * A smaller spread (maxRank - minRank) means better balance.
 * The total strength score is negative — worse spreads get lower scores.
 *
 * @param table - Array of player IDs at this table
 * @param playersById - Map of player ID → PairingPlayer (includes rank)
 * @param weights - PairingWeights config
 * @returns Object containing:
 *   - `strengthTotal`: weighted total for the table (negative, higher is better)
 *   - `rankByPlayer`: Map of playerId → rank for reuse
 */
function calculateStrengthBalance(
  table: number[],
  playersById: Map<number, PairingPlayer>,
  weights: PairingWeights
): {
  strengthTotal: number
  rankByPlayer: Map<number, number>
} {
  const ranks = table
    .map(id => playersById.get(id)?.rank ?? 9999)
    .sort((a, b) => a - b)

  let strengthSpreadPenalty = 0
  if (ranks.length > 1) {
    strengthSpreadPenalty = (ranks[ranks.length - 1] ?? 0) - (ranks[0] ?? 0)
  }

  const strengthTotal = -strengthSpreadPenalty * weights.strengthBalance
  const rankByPlayer = new Map<number, number>(
    table.map(playerId => [playerId, playersById.get(playerId)?.rank ?? 9999])
  )

  return { strengthTotal, rankByPlayer }
}

/**
 * Distributes the strength balance score among individual players.
 *
 * Players with ranks closer to the table average receive a smaller share
 * of the negative strengthTotal. Well-balanced tables split the penalty
 * evenly; unbalanced tables penalize outliers more.
 *
 * @param table - Array of player IDs at this table
 * @param perPlayer - Mutable Map of playerId → PairingPlayerScore to update
 * @param strengthTotal - Weighted strength total for the table
 * @param rankByPlayer - Map of playerId → rank
 */
function distributeStrengthBalance(
  table: number[],
  perPlayer: Map<number, PairingPlayerScore>,
  strengthTotal: number,
  rankByPlayer: Map<number, number>
): void {
  if (table.length === 0) return

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
    if (playerScore) {
      playerScore.strengthBalance += share
    }
  }
}

/**
 * Calculates the 3-player table rotation penalty.
 *
 * When a player is repeatedly seated at 3-player tables, they get
 * fewer games per round (miss one match). This penalty discourages
 * clustering the same players in short tables across rounds.
 *
 * @param table - Array of player IDs at this table
 * @param playersById - Map of player ID → PairingPlayer (includes table3Count)
 * @returns Total rotation penalty for the table (≥ 0)
 */
function calculateTable3Penalty(
  table: number[],
  playersById: Map<number, PairingPlayer>
): number {
  if (table.length !== 3) return 0

  return table.reduce((acc, playerId) => {
    const player = playersById.get(playerId)
    return acc + (player?.table3Count ?? 0)
  }, 0)
}

/**
 * Applies per-player 3-player table rotation penalties.
 *
 * Each player's individual `table3Count` is weighted negatively
 * and added to their personal score.
 *
 * @param table - Array of player IDs at this table
 * @param perPlayer - Mutable Map of playerId → PairingPlayerScore to update
 * @param playersById - Map of player ID → PairingPlayer (includes table3Count)
 * @param weights - PairingWeights config
 */
function distributeTable3Penalty(
  table: number[],
  perPlayer: Map<number, PairingPlayerScore>,
  playersById: Map<number, PairingPlayer>,
  weights: PairingWeights
): void {
  if (table.length !== 3) return

  for (const playerId of table) {
    const playerScore = perPlayer.get(playerId)
    if (!playerScore) continue

    const table3Count = playersById.get(playerId)?.table3Count ?? 0
    playerScore.rotateTable3 -= table3Count * weights.rotateTable3
  }
}

/**
 * Calculates novelty and rematch penalties for all pairs at a table.
 *
 * For every unique pair (i, j) where i < j:
 * - If they have NEVER met: +1 novelty, split `weights.novelty / 2` per player
 * - If they HAVE met before: penalty = (matchCount + recencyFactor) * weights.rematch
 *   where recencyFactor = 1 / (currentRound - lastRound), decaying over time
 *   The penalty is split equally between both players.
 *
 * @param table - Array of player IDs at this table
 * @param perPlayer - Mutable Map of playerId → PairingPlayerScore to update
 * @param rematchMap - Map of "minId-maxId" → { count, lastRound }
 * @param currentRound - Current round number (for recency decay)
 * @param weights - PairingWeights config
 * @returns Object containing:
 *   - `novelty`: count of never-before-seen pairs at this table
 *   - `rematchPenalty`: accumulated rematch penalty (≥ 0, higher = worse)
 */
function calculatePairwiseScore(
  table: number[],
  perPlayer: Map<number, PairingPlayerScore>,
  rematchMap: Map<string, { count: number, lastRound: number }>,
  currentRound: number,
  weights: PairingWeights
): { novelty: number; rematchPenalty: number } {
  let novelty = 0
  let rematchPenalty = 0

  forEachPair(table, (left, right) => {
    const key = pairKey(left, right)
    const rematch = rematchMap.get(key)

    if (!rematch) {
      novelty += 1
      const leftScore = perPlayer.get(left)
      const rightScore = perPlayer.get(right)
      if (leftScore) leftScore.novelty += weights.novelty / 2
      if (rightScore) rightScore.novelty += weights.novelty / 2
      return
    }

    const roundsAgo = Math.max(1, currentRound - rematch.lastRound)
    const recencyFactor = 1 / roundsAgo
    const pairPenalty = rematch.count + recencyFactor
    rematchPenalty += pairPenalty

    const penaltyValue = -pairPenalty * weights.rematch / 2
    const leftScore = perPlayer.get(left)
    const rightScore = perPlayer.get(right)
    if (leftScore) leftScore.rematchPenalty += penaltyValue
    if (rightScore) rightScore.rematchPenalty += penaltyValue
  })

  return { novelty, rematchPenalty }
}

/**
 * Aggregates all per-player scores into final table-level totals.
 *
 * Computes each player's `total` from individual components:
 * strengthBalance + novelty + rematchPenalty + rotateTable3 + tableSizeWeight
 *
 * Also computes the overall table score from intermediate results.
 *
 * @param table - Array of player IDs at this table
 * @param perPlayer - Mutable Map of playerId → PairingPlayerScore
 * @param weights - PairingWeights config
 * @param params - Intermediate scoring results:
 *   - `strengthTotal`: weighted strength total (already includes weights.strengthBalance)
 *   - `novelty`: raw count of new pairings (weighted here via weights.novelty)
 *   - `rematchPenalty`: raw accumulated rematch penalty (weighted here via weights.rematch)
 *   - `rotateTable3`: raw 3-player rotation penalty (weighted here via weights.rotateTable3)
 * @returns Final PairingTableScore with per-player breakdown
 */
function aggregateTableScore(
  table: number[],
  perPlayer: Map<number, PairingPlayerScore>,
  weights: PairingWeights,
  params: {
    strengthTotal: number
    novelty: number
    rematchPenalty: number
    rotateTable3: number
  }
): PairingTableScore {
  const { strengthTotal, novelty, rematchPenalty, rotateTable3 } = params
  const size = table.length
  const tableSizeWeight = size === 4 ? weights.tableSize4 : weights.tableSize3
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
    strengthBalance: strengthTotal,
    novelty: novelty * weights.novelty,
    rematchPenalty: -rematchPenalty * weights.rematch,
    rotateTable3: -rotateTable3 * weights.rotateTable3,
    tableSizeWeight,
    total,
    players: table.map(playerId => perPlayer.get(playerId)).filter((entry): entry is PairingPlayerScore => entry !== undefined),
  }
}

/**
 * Scores a single table based on strength balance, novelty, rematches,
 * table-size preference, and 3-player rotation penalties.
 *
 * Higher scores = better pairings.
 * - Strength balance rewards evenly-matched players
 * - Novelty rewards never-before-seen pairings
 * - Rematch penalty discourages repeat opponents (decays with time)
 * - Table-size preference rewards 4-player tables, penalizes 3-player
 * - Rotation penalty discourages repeated 3-player table assignments
 *
 * @param table - Array of player IDs seated at this table
 * @param playersById - Map of player ID → PairingPlayer (rank, table3Count)
 * @param rematchMap - Map of "minId-maxId" → { count, lastRound }
 * @param currentRound - Current round number (for recency decay)
 * @param weights - PairingWeights config
 * @returns PairingTableScore with total and per-player breakdown
 */
function scoreTable(
  table: number[],
  playersById: Map<number, PairingPlayer>,
  rematchMap: Map<string, { count: number, lastRound: number }>,
  currentRound: number,
  weights: PairingWeights
): PairingTableScore {
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

  const { strengthTotal, rankByPlayer } = calculateStrengthBalance(table, playersById, weights)
  distributeStrengthBalance(table, perPlayer, strengthTotal, rankByPlayer)

  const rotateTable3 = calculateTable3Penalty(table, playersById)
  distributeTable3Penalty(table, perPlayer, playersById, weights)

  const { novelty, rematchPenalty } = calculatePairwiseScore(table, perPlayer, rematchMap, currentRound, weights)

  return aggregateTableScore(table, perPlayer, weights, {
    strengthTotal,
    novelty,
    rematchPenalty,
    rotateTable3,
  })
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

// ── Public scoring API ─────────────────────────────────────────────────────────

/**
 * Scores an already-built table arrangement without modifying it.
 * Used to preview/validate a candidate seating (e.g. a manually edited one) using the
 * same scoring function `optimizePairings` uses internally, so results are comparable.
 */
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

// ── Solution construction (greedy) ────────────────────────────────────────────

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

// ── Solution improvement (local search) ───────────────────────────────────────

function cloneTables(tables: number[][]): number[][] {
  return tables.map(table => [...table])
}

/** Clones `working`, swaps seat `i` of table `t1` with seat `j` of table `t2`, and scores the result. */
function trySwapCandidate(
  working: number[][],
  t1: number,
  t2: number,
  i: number,
  j: number,
  playersById: Map<number, PairingPlayer>,
  rematchMap: Map<string, { count: number, lastRound: number }>,
  forbiddenSet: Set<string>,
  currentRound: number,
  weights: PairingWeights
): { candidate: number[][]; scored: PairingOptimizerResult } | null {
  const candidate = cloneTables(working)
  const c1 = candidate[t1]
  const c2 = candidate[t2]
  if (!c1 || !c2) return null

  const left = c1[i]
  const right = c2[j]
  if (left === undefined || right === undefined) return null

  c1[i] = right
  c2[j] = left

  const scored = scoreSolution(candidate, playersById, rematchMap, forbiddenSet, currentRound, weights)
  return { candidate, scored }
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

          const attempt = trySwapCandidate(working, t1, t2, i, j, playersById, rematchMap, forbiddenSet, currentRound, weights)
          if (attempt && attempt.scored.totalScore > best.totalScore) {
            best = attempt.scored
            working = cloneTables(attempt.candidate)
          }
        }
      }
    }
  }

  return best
}

// ── Public optimization API ───────────────────────────────────────────────────

/**
 * Builds a table seating for the round via multi-start greedy construction + local search.
 *
 * Runs 3 independent attempts, each seeding player order by a different priority
 * (rank, table-3 rotation need, score), builds tables greedily table-by-table — at each
 * seat picking whichever remaining player maximizes the table's running score while
 * respecting forbidden pairs — then improves that result with a pairwise swap search
 * within a time budget (default 120ms total, split evenly across the 3 attempts).
 * The best-scoring result across all 3 attempts is returned.
 *
 * Multiple seed orders exist because greedy construction is order-sensitive: a single seed
 * can get stuck in a local optimum the swap search can't escape from, so trying a few
 * different starting points and keeping the best materially improves table quality.
 */
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

// ── Utilities ──────────────────────────────────────────────────────────────────

export function getForbiddenPairKey(playerA: number, playerB: number): string {
  return pairKey(playerA, playerB)
}
