/**
 * Recupera dati dalla cache localStorage se non scaduti
 * @param key - Chiave della cache
 * @param ttlMs - Tempo di vita in millisecondi
 * @returns Dati in cache o null se scaduti/non trovati
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
 * Salva dati in localStorage con timestamp corrente
 * @param key - Chiave della cache
 * @param data - Dati da salvare
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
