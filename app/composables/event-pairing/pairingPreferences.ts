// app\composables\event-pairing\pairingPreferences.ts
import type { PairingWeights } from '#shared/utils/types'
import { DEFAULT_PAIRING_WEIGHTS } from './pairingOptimizer'

function storageKey(tournamentId: number): string {
  return `pairing-preferences-event-${tournamentId}`
}

export function getPairingWeights(tournamentId: number): PairingWeights {
  if (!import.meta.client) return { ...DEFAULT_PAIRING_WEIGHTS }

  try {
    const raw = localStorage.getItem(storageKey(tournamentId))
    if (!raw) return { ...DEFAULT_PAIRING_WEIGHTS }

    const parsed = JSON.parse(raw) as Partial<{ weights: Partial<PairingWeights> }>

    return {
      ...DEFAULT_PAIRING_WEIGHTS,
      ...(parsed.weights ?? {}),
    }
  }
  catch {
    return { ...DEFAULT_PAIRING_WEIGHTS }
  }
}

export function savePairingWeights(tournamentId: number, weights: PairingWeights): void {
  if (!import.meta.client) return

  localStorage.setItem(storageKey(tournamentId), JSON.stringify({ weights }))
}
