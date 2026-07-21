// app\utils\bracketLevels.ts
// Module-scope const — can't call useI18n() here (see root CLAUDE.md), so
// this stores i18n *keys*, not translated text. Resolve `t(key)` at the
// consuming component's own setup(). Order/values match WotC's official
// Commander bracket system (Exhibition/Core/Upgraded/Optimized/cEDH).
import type { SemanticColor } from './semanticColor'

export interface BracketLevelDefinition {
  level: 1 | 2 | 3 | 4 | 5
  nameKey: string
  experienceKey: string
  deckBuildingKey: string
}

export const BRACKET_LEVELS: readonly BracketLevelDefinition[] = [
  { level: 1, nameKey: 'bracket.level1.name', experienceKey: 'bracket.level1.experience', deckBuildingKey: 'bracket.level1.deckBuilding' },
  { level: 2, nameKey: 'bracket.level2.name', experienceKey: 'bracket.level2.experience', deckBuildingKey: 'bracket.level2.deckBuilding' },
  { level: 3, nameKey: 'bracket.level3.name', experienceKey: 'bracket.level3.experience', deckBuildingKey: 'bracket.level3.deckBuilding' },
  { level: 4, nameKey: 'bracket.level4.name', experienceKey: 'bracket.level4.experience', deckBuildingKey: 'bracket.level4.deckBuilding' },
  { level: 5, nameKey: 'bracket.level5.name', experienceKey: 'bracket.level5.experience', deckBuildingKey: 'bracket.level5.deckBuilding' },
]

/** Semantic color per bracket (success→info→primary→warning→error), a casual→competitive intensity ramp using app.config.ts's existing tokens — not a new palette. */
export const BRACKET_COLORS: Record<1 | 2 | 3 | 4 | 5, SemanticColor> = {
  1: 'success',
  2: 'info',
  3: 'primary',
  4: 'warning',
  5: 'error',
}
