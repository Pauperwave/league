import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAIRING_WEIGHTS,
  optimizePairings,
  scorePairingTables,
  type PairingTableScore,
  getForbiddenPairKey,
  type PairingHistoryEntry,
  type PairingPlayer,
} from './pairingOptimizer'

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
})
