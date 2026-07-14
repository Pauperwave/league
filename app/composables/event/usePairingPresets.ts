// app\composables\event\usePairingPresets.ts
import type { PairingWeights } from '#shared/utils/types'
import type { Ref } from 'vue'
import type { PairingPresetKind } from '~/components/event/pairing/settings/PairingPresetButtons.vue'

const SOCIAL_PRESET: PairingWeights = {
  strengthBalance: 0.8,
  novelty: 1.7,
  rematch: 1.8,
  rotateTable3: 1.3,
  tableSize4: 0.1,
  tableSize3: -0.2,
}

const COMPETITIVE_PRESET: PairingWeights = {
  strengthBalance: 1.8,
  novelty: 0.9,
  rematch: 1.2,
  rotateTable3: 0.8,
  tableSize4: 0.2,
  tableSize3: -0.1,
}

function sameWeights(left: PairingWeights, right: PairingWeights): boolean {
  return isCloseTo(left.strengthBalance, right.strengthBalance)
    && isCloseTo(left.novelty, right.novelty)
    && isCloseTo(left.rematch, right.rematch)
    && isCloseTo(left.rotateTable3, right.rotateTable3)
    && isCloseTo(left.tableSize4, right.tableSize4)
    && isCloseTo(left.tableSize3, right.tableSize3)
}

export function usePairingPresets(weights: Ref<PairingWeights>, setWeights: (nextWeights: Partial<PairingWeights>) => void) {
  const selectedPreset = computed<PairingPresetKind>(() => {
    const current = weights.value

    if (sameWeights(current, DEFAULT_PAIRING_WEIGHTS)) return 'balanced'
    if (sameWeights(current, SOCIAL_PRESET)) return 'social'
    if (sameWeights(current, COMPETITIVE_PRESET)) return 'competitive'

    return 'custom'
  })

  function applyWeightPreset(kind: Exclude<PairingPresetKind, 'custom'>) {
    if (kind === 'reset' || kind === 'balanced') {
      setWeights({ ...DEFAULT_PAIRING_WEIGHTS })
      return
    }

    if (kind === 'social') {
      setWeights({ ...SOCIAL_PRESET })
      return
    }

    setWeights({ ...COMPETITIVE_PRESET })
  }

  return {
    selectedPreset,
    applyWeightPreset,
  }
}
