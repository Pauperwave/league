export function useTableCalculator() {
  function calculateTables(playerCount: number): { canPlay: boolean; tables4: number; tables3: number } {
    if (playerCount < 3 || playerCount === 5) {
      return { canPlay: false, tables4: 0, tables3: 0 }
    }

    let remaining = playerCount
    let tables4 = 0
    let tables3 = 0

    while (remaining >= 4) {
      tables4++
      remaining -= 4
    }

    while (remaining > 0) {
      if (remaining >= 3 && (remaining - 3) !== 2) {
        tables3++
        remaining -= 3
      } else if (remaining === 2 && tables4 > 0) {
        tables4--
        tables3 += 2
        remaining = 0
      } else {
        tables3++
        remaining -= 3
      }
    }

    return { canPlay: true, tables4, tables3 }
  }

  function formatTableEstimate(tables4: number, tables3: number): string {
    const parts: string[] = []
    if (tables4 > 0) {
      parts.push(`${tables4} tavol${tables4 === 1 ? 'o' : 'i'} da 4`)
    }
    if (tables3 > 0) {
      parts.push(`${tables3} tavol${tables3 === 1 ? 'o' : 'i'} da 3`)
    }
    return parts.join(' e ')
  }

  return {
    calculateTables,
    formatTableEstimate,
  }
}
