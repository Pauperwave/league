// app\utils\playerAvatar.ts
import { Style, Avatar } from '@dicebear/core'
import adventurer from '@dicebear/styles/adventurer.json'

// One Style instance reused across every avatar (per DiceBear's own
// guidance) — parsing/validating the style definition is the expensive part,
// not rendering an individual avatar from it.
const style = new Style(adventurer)

/**
 * Deterministic placeholder avatar (DiceBear "adventurer") for a player with
 * no real `avatarUrl` — same seed always renders the same SVG, generated
 * fully client- and server-side with no network call. `idRandomization:
 * false` (DiceBear's own default) keeps SSR and client renders byte-identical,
 * avoiding a hydration mismatch on the generated element IDs.
 */
export function generatePlayerAvatar(seed: string | number): string {
  return new Avatar(style, { seed: String(seed), size: 128, idRandomization: false }).toDataUri()
}
