export function useTableCalculator() {
  function calculateTables(playerCount: number): { canPlay: boolean; tables4: number; tables3: number } {
    if (playerCount < 3 || playerCount === 5) {
      return { canPlay: false, tables4: 0, tables3: 0 }
    }

    const tables3 = (4 - (playerCount % 4)) % 4
    const tables4 = (playerCount - tables3 * 3) / 4

    return { canPlay: true, tables4, tables3 }
  }

  function formatTableEstimate(tables4: number, tables3: number): string {
    const parts: string[] = []
    if (tables4 > 0) parts.push(`${tables4} tavol${tables4 === 1 ? 'o' : 'i'} da 4`)
    if (tables3 > 0) parts.push(`${tables3} tavol${tables3 === 1 ? 'o' : 'i'} da 3`)
    return parts.join(' e ')
  }

  return { calculateTables, formatTableEstimate }
}
