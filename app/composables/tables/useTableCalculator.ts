// Centralized table sizing and preview helpers used by event flow and pairing logic.
export function useTableCalculator() {
  function calculateTables(playerCount: number): { canPlay: boolean; tables4: number; tables3: number } {
    if (playerCount < 3 || playerCount === 5) {
      return { canPlay: false, tables4: 0, tables3: 0 }
    }

    const tables3 = (4 - (playerCount % 4)) % 4
    const tables4 = (playerCount - tables3 * 3) / 4

    return { canPlay: true, tables4, tables3 }
  }

  function getTableSizes(playerCount: number): number[] {
    const result = calculateTables(playerCount)
    if (!result.canPlay) return []

    return [
      ...Array.from({ length: result.tables4 }, () => 4),
      ...Array.from({ length: result.tables3 }, () => 3),
    ]
  }

  function buildPreviewTables(playerIds: number[]): number[][] {
    const sizes = getTableSizes(playerIds.length)
    if (!sizes.length) return []

    const tables: number[][] = []
    let cursor = 0

    for (const size of sizes) {
      tables.push(playerIds.slice(cursor, cursor + size))
      cursor += size
    }

    return tables
  }

  function formatTableEstimate(tables4: number, tables3: number): string {
    const parts: string[] = []
    if (tables4 > 0) parts.push(`${tables4} tavol${tables4 === 1 ? 'o' : 'i'} da 4`)
    if (tables3 > 0) parts.push(`${tables3} tavol${tables3 === 1 ? 'o' : 'i'} da 3`)
    return parts.join(' e ')
  }

  return { calculateTables, getTableSizes, buildPreviewTables, formatTableEstimate }
}
