// app\utils\cardColors.ts
import type { CommanderCard } from '~/composables/commanders/useCommanderCards'

export const COLOR_MAP: Record<string, string> = {
  W: 'amber-100',
  U: 'blue-600',
  B: 'gray-950',
  R: 'red-600',
  G: 'green-600',
  C: 'gray-300',
}

/** Extracts WUBRG color letters from a mana cost string like "{2}{W}{U}". */
export function extractColorsFromManaCost(costString: string): Set<string> {
  const colors = new Set<string>()
  const matches = costString.match(/{([^}]*)}/g) || []

  matches.forEach((mana) => {
    const content = mana.replace(/[{}]/g, '')
    for (const c of content) {
      if ('WUBRGC'.includes(c) && c !== 'P') {
        colors.add(c)
      }
    }
  })

  return colors
}

/** Resolves a card's display colors from its mana cost(s), falling back to color identity, then colorless. */
export function resolveCardColors(card: Pick<CommanderCard, 'manaCost' | 'isDoubleFaced' | 'backManaCost' | 'colorIdentity'>): string[] {
  const colors = new Set<string>()

  if (card.manaCost) {
    extractColorsFromManaCost(card.manaCost).forEach(c => colors.add(c))
  }

  if (card.isDoubleFaced && card.backManaCost) {
    extractColorsFromManaCost(card.backManaCost).forEach(c => colors.add(c))
  }

  if (colors.size === 0 && card.colorIdentity?.length) {
    card.colorIdentity.forEach(c => colors.add(c))
  }

  if (colors.size === 0) return ['C']
  return Array.from(colors)
}

/** Builds a Tailwind gradient background class from a card's resolved colors. */
export function buildGradientClass(colors: string[]): string {
  if (colors.length > 3) {
    return 'bg-gradient-to-br from-amber-200 via-amber-200 to-transparent'
  }

  if (colors.length === 3) {
    const [from, via, to] = colors.map(c => COLOR_MAP[c] || COLOR_MAP.C)
    return `bg-gradient-to-r from-${from} via-${via} to-${to}`
  }

  if (colors.length === 2) {
    const [from, to] = colors.map(c => COLOR_MAP[c] || COLOR_MAP.C)
    return `bg-gradient-to-br from-${from} to-${to}`
  }

  const color = COLOR_MAP[colors[0]!] || COLOR_MAP.C
  return `bg-gradient-to-br from-${color} via-${color} to-transparent`
}
