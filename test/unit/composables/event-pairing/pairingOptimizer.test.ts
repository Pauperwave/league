// test\unit\composables\event-pairing\pairingOptimizer.test.ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAIRING_WEIGHTS,
  optimizePairings,
  scorePairingTables,
  type PairingTableScore,
  getForbiddenPairKey,
  type PairingHistoryEntry,
  type PairingPlayer,
} from '~/composables/event-pairing/pairingOptimizer'

const players: PairingPlayer[] = [
  { id: 1, rank: 1, score: 30, table3Count: 0 },
  { id: 2, rank: 2, score: 28, table3Count: 1 },
  { id: 3, rank: 3, score: 24, table3Count: 0 },
  { id: 4, rank: 4, score: 22, table3Count: 2 },
  { id: 5, rank: 5, score: 20, table3Count: 1 },
  { id: 6, rank: 6, score: 18, table3Count: 0 },
  { id: 7, rank: 7, score: 16, table3Count: 1 },
  { id: 8, rank: 8, score: 12, table3Count: 0 },
]

const history: PairingHistoryEntry[] = [
  { round: 1, players: [1, 2, 3, 4] },
  { round: 1, players: [5, 6, 7, 8] },
  { round: 2, players: [1, 5, 6, 7] },
]

describe('pairingOptimizer', () => {
  function scorePlayerTotals(tableScore: PairingTableScore): number {
    return tableScore.players.reduce((acc, player) => acc + player.total, 0)
  }

  it('never assigns duplicate players', () => {
    const result = optimizePairings({
      players,
      history,
      forbiddenPairs: [],
      currentRound: 3,
      weights: DEFAULT_PAIRING_WEIGHTS,
    })

    const flat = result.tables.flat()
    expect(new Set(flat).size).toBe(flat.length)
    expect(flat.length).toBe(players.length)
  })

  it('respects forbidden pairs', () => {
    const forbidden = [
      { playerA: 1, playerB: 2 },
      { playerA: 5, playerB: 6 },
    ]

    const result = optimizePairings({
      players,
      history,
      forbiddenPairs: forbidden,
      currentRound: 3,
      weights: DEFAULT_PAIRING_WEIGHTS,
    })

    const conflicts = result.tables.some((table) => {
      const keys = new Set<string>()
      for (let i = 0; i < table.length; i++) {
        for (let j = i + 1; j < table.length; j++) {
          const left = table[i]
          const right = table[j]
          if (left === undefined || right === undefined) continue
          keys.add(getForbiddenPairKey(left, right))
        }
      }

      return keys.has(getForbiddenPairKey(1, 2)) || keys.has(getForbiddenPairKey(5, 6))
    })

    expect(conflicts).toBe(false)
  })

  it('returns an invalid (non-finite) result for an unplayable player count instead of wiping the seating', () => {
    // Regression: getTableSizes(5) returns [] (no valid 3/4-seat split for
    // exactly 5 players), and without a guard every build attempt produced
    // zero tables scoring a *finite* 0 — beating the initial -Infinity
    // `best` and returning a spuriously "valid" empty result. The caller
    // (useTableDnd's runOptimizer) only checks Number.isFinite before
    // calling replaceByPlayerOrder(result.tables.flat()), so that silently
    // wiped every seat assignment on the preview.
    const fivePlayers = players.slice(0, 5)

    const result = optimizePairings({
      players: fivePlayers,
      history,
      forbiddenPairs: [],
      currentRound: 3,
      weights: DEFAULT_PAIRING_WEIGHTS,
    })

    expect(Number.isFinite(result.totalScore)).toBe(false)
    expect(result.tables).toEqual([])
  })

  it('penalizes invalid manual tables with forbidden pairs', () => {
    const scored = scorePairingTables({
      tables: [[1, 2, 3, 4], [5, 6, 7, 8]],
      players,
      history,
      forbiddenPairs: [{ playerA: 1, playerB: 2 }],
      currentRound: 3,
      weights: DEFAULT_PAIRING_WEIGHTS,
    })

    expect(scored.isValid).toBe(false)
    expect(scored.totalScore).toBe(Number.NEGATIVE_INFINITY)
  })

  it('uses valid table sizes from calculator for 10 players', () => {
    const tenPlayers: PairingPlayer[] = [
      ...players,
      { id: 9, rank: 9, score: 10, table3Count: 0 },
      { id: 10, rank: 10, score: 8, table3Count: 1 },
    ]

    const result = optimizePairings({
      players: tenPlayers,
      history,
      forbiddenPairs: [],
      currentRound: 3,
      weights: DEFAULT_PAIRING_WEIGHTS,
    })

    const sizes = result.tables.map(t => t.length).sort((a, b) => a - b)
    expect(sizes).toEqual([3, 3, 4])
  })

  it('provides per-player score details that sum to table total', () => {
    const scored = scorePairingTables({
      tables: [[1, 2, 3, 4], [5, 6, 7, 8]],
      players,
      history,
      forbiddenPairs: [],
      currentRound: 3,
      weights: DEFAULT_PAIRING_WEIGHTS,
    })

    expect(scored.isValid).toBe(true)
    for (const tableScore of scored.tableScores) {
      const sum = scorePlayerTotals(tableScore)
      expect(Math.abs(sum - tableScore.total)).toBeLessThan(0.0001)
    }
  })

  it('keeps player score details aligned with table players', () => {
    const scored = scorePairingTables({
      tables: [[1, 2, 3, 4]],
      players,
      history,
      forbiddenPairs: [],
      currentRound: 3,
      weights: DEFAULT_PAIRING_WEIGHTS,
    })

    const table = scored.tableScores[0]
    expect(table).toBeDefined()
    if (!table) return

    const ids = table.players.map(player => player.playerId).sort((a, b) => a - b)
    expect(ids).toEqual([1, 2, 3, 4])
  })

  // ── Cross-tournament rematch history (ADR-054) ──────────────────────────────
  // leagueRematchCounts is a flat, undecayed per-pair count from the league's
  // OTHER tournaments, folded into the same weights.rematch as the
  // in-tournament signal. Round numbers aren't comparable across tournaments,
  // so there's no recency factor for that half.

  it('penalizes a pair with league-wide history only, and does not count it as novel', () => {
    const scored = scorePairingTables({
      tables: [[1, 2, 3, 4]],
      players,
      history: [], // nothing played yet THIS tournament
      forbiddenPairs: [],
      currentRound: 1,
      weights: DEFAULT_PAIRING_WEIGHTS,
      leagueRematchCounts: new Map([[getForbiddenPairKey(1, 2), 1]]),
    })

    const table = scored.tableScores[0]
    expect(table).toBeDefined()
    if (!table) return

    // 6 pairs total, 5 of them genuinely never-met; (1,2) met once in another
    // tournament → rematch branch with recencyFactor 0, penalty exactly 1.
    expect(table.novelty).toBeCloseTo(5 * DEFAULT_PAIRING_WEIGHTS.novelty, 6)
    expect(table.rematchPenalty).toBeCloseTo(-1 * DEFAULT_PAIRING_WEIGHTS.rematch, 6)
    expect(Math.abs(scorePlayerTotals(table) - table.total)).toBeLessThan(0.0001)
  })

  it('sums in-tournament and league-wide history for a pair that has both', () => {
    const scored = scorePairingTables({
      tables: [[1, 2, 3, 4]],
      players,
      history: [{ round: 1, players: [1, 2, 3, 4] }],
      forbiddenPairs: [],
      currentRound: 3,
      weights: DEFAULT_PAIRING_WEIGHTS,
      leagueRematchCounts: new Map([[getForbiddenPairKey(1, 2), 2]]),
    })

    const table = scored.tableScores[0]
    expect(table).toBeDefined()
    if (!table) return

    // Every pair met once in round 1 → count 1 + recencyFactor 1/(3-1) = 1.5.
    // (1, 2) additionally met twice in other tournaments → 1.5 + 2 = 3.5.
    const rawPenalty = 5 * 1.5 + 3.5
    expect(table.novelty).toBe(0)
    expect(table.rematchPenalty).toBeCloseTo(-rawPenalty * DEFAULT_PAIRING_WEIGHTS.rematch, 6)
    expect(Math.abs(scorePlayerTotals(table) - table.total)).toBeLessThan(0.0001)
  })

  it('scores identically whether leagueRematchCounts is omitted or empty', () => {
    const args = {
      tables: [[1, 2, 3, 4], [5, 6, 7, 8]],
      players,
      history,
      forbiddenPairs: [],
      currentRound: 3,
      weights: DEFAULT_PAIRING_WEIGHTS,
    }

    const withoutParam = scorePairingTables(args)
    const withEmptyMap = scorePairingTables({ ...args, leagueRematchCounts: new Map() })

    expect(withEmptyMap.totalScore).toBe(withoutParam.totalScore)
    expect(withEmptyMap.tableScores).toEqual(withoutParam.tableScores)
  })
})
