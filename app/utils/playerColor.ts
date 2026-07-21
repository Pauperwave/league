// app\utils\playerColor.ts
import type { SemanticColor } from './semanticColor'

export type PlayerColor = SemanticColor

// Cycles through app.config.ts's 6 semantic Nuxt UI color tokens (rather than
// arbitrary hex) so a player's kill-flow edges/badges share one color across
// components, consistent with the rest of the app's design system.
const PLAYER_COLORS: PlayerColor[] = ['primary', 'secondary', 'success', 'info', 'warning', 'error']

export function getPlayerColorMap(players: { id: number }[]): Map<string, PlayerColor> {
  return new Map(players.map((player, index) => [String(player.id), PLAYER_COLORS[index % PLAYER_COLORS.length]!]))
}
