/**
 * Retrieves data from the localStorage cache if not expired
 * @param key - Cache key
 * @param ttlMs - Time to live in milliseconds
 * @returns Cached data, or null if expired/not found
 */
export function getCached<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.ts !== 'number') return null

    if (Date.now() - parsed.ts > ttlMs) {
      localStorage.removeItem(key)
      return null
    }

    return parsed.data as T
  }
  catch {
    return null
  }
}

/**
 * Saves data to localStorage with the current timestamp
 * @param key - Cache key
 * @param data - Data to save
 */
export function setCached<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
  }
  catch {
    // Silently fail if localStorage is full or disabled
  }
}
