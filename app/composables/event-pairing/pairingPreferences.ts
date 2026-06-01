import type { PairingForbiddenPair, PairingWeights } from '#shared/utils/types'
import { DEFAULT_PAIRING_WEIGHTS } from './pairingOptimizer'

interface PairingPreferences {
  weights: PairingWeights
  forbiddenPairs: PairingForbiddenPair[]
}

function storageKey(eventId: number): string {
  return `pairing-preferences-event-${eventId}`
}

function normalizeForbiddenPairs(pairs: PairingForbiddenPair[]): PairingForbiddenPair[] {
  const dedup = new Set<string>()
  const result: PairingForbiddenPair[] = []

  for (const pair of pairs) {
    if (pair.playerA === pair.playerB) continue
    // Keep original order, only remove duplicates
    const key = `${pair.playerA}-${pair.playerB}`
    const reverseKey = `${pair.playerB}-${pair.playerA}`
    if (dedup.has(key) || dedup.has(reverseKey)) continue

    dedup.add(key)
    result.push({ playerA: pair.playerA, playerB: pair.playerB })
  }

  return result
}

export function getPairingPreferences(eventId: number): PairingPreferences {
  const fallback: PairingPreferences = {
    weights: { ...DEFAULT_PAIRING_WEIGHTS },
    forbiddenPairs: [],
  }

  if (!import.meta.client) return fallback

  try {
    const raw = localStorage.getItem(storageKey(eventId))
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as Partial<PairingPreferences>

    return {
      weights: {
        ...DEFAULT_PAIRING_WEIGHTS,
        ...(parsed.weights ?? {}),
      },
      forbiddenPairs: normalizeForbiddenPairs(parsed.forbiddenPairs ?? []),
    }
  }
  catch {
    return fallback
  }
}

export function savePairingPreferences(eventId: number, prefs: PairingPreferences): void {
  if (!import.meta.client) return

  const normalized: PairingPreferences = {
    weights: {
      ...DEFAULT_PAIRING_WEIGHTS,
      ...prefs.weights,
    },
    forbiddenPairs: normalizeForbiddenPairs(prefs.forbiddenPairs),
  }

  localStorage.setItem(storageKey(eventId), JSON.stringify(normalized))
}

export function normalizePairingForbiddenPairs(pairs: PairingForbiddenPair[]): PairingForbiddenPair[] {
  return normalizeForbiddenPairs(pairs)
}
