// app\utils\slug.ts

import _slugify from 'slugify'

/**
 * Generates a URL-friendly slug from any text.
 * Example: "Emanuele Nardi" -> "emanuele-nardi"
 */
export function slugify(text: string): string {
  return _slugify(text, { lower: true, strict: true })
}
