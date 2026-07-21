// app\utils\bracketLevels.ts
// Module-scope const — can't call useI18n() here (see root CLAUDE.md), so
// this stores i18n *keys*, not translated text. Resolve `t(key)` at the
// consuming component's own setup(). Order/values match WotC's official
// Commander bracket system (Exhibition/Core/Upgraded/Optimized/cEDH).
import type { SemanticColor } from './semanticColor'

/** Valid values of `commander_decks.bracket_level` (DB CHECK constraint: 1-5). */
export type BracketLevel = 1 | 2 | 3 | 4 | 5

export interface BracketLevelDefinition {
  level: BracketLevel
  nameKey: string
  experienceKey: string
  deckBuildingKey: string
}

// Each level's i18n keys follow the fixed `bracket.level${n}.xxx` pattern in
// i18n/locales/it.json, so they're generated rather than hand-typed —
// removes the risk of a copy-paste mismatch between a level number and its
// own keys (level3 hand-typed with level4's keys, etc).
export const BRACKET_LEVELS: readonly BracketLevelDefinition[] = Array.from({ length: 5 }, (_, i) => {
  const level = (i + 1) as BracketLevelDefinition['level']
  return {
    level,
    nameKey: `bracket.level${level}.name`,
    experienceKey: `bracket.level${level}.experience`,
    deckBuildingKey: `bracket.level${level}.deckBuilding`,
  }
})

/** Semantic color per bracket (success→info→primary→warning→error), a casual→competitive intensity ramp using app.config.ts's existing tokens — not a new palette. */
export const BRACKET_COLORS: Record<BracketLevel, SemanticColor> = {
  1: 'success',
  2: 'info',
  3: 'primary',
  4: 'warning',
  5: 'error',
}
