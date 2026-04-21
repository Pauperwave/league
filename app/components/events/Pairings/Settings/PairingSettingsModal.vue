<script setup lang="ts">
import type { PairingWeights } from '#shared/utils/types'
import type { PairingPresetKind } from './PairingPresetButtons.vue'
import ForbiddenPairsSection from './ForbiddenPairsSection.vue'

interface ForbiddenPairDisplay {
  key: string
  playerA: number
  playerB: number
  label: string
}

interface WeightItem {
  key: keyof PairingWeights
  label: string
  value: number
  min: number
  max: number
  step: number
}

interface Props {
  selectedPreset: PairingPresetKind
  scoreItems: ReadonlyArray<WeightItem>
  pairPlayerA: string
  pairPlayerB: string
  playerOptions: Array<{ label: string; value: string }>
  forbiddenPairsDisplay: ForbiddenPairDisplay[]
  canAddForbiddenPair: boolean
  pairingStorageKey: string
}

defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })
const pairPlayerAModel = defineModel<string>('pairPlayerA', { default: '' })
const pairPlayerBModel = defineModel<string>('pairPlayerB', { default: '' })

const emit = defineEmits<{
  selectPreset: [preset: Exclude<PairingPresetKind, 'custom'>]
  updateWeight: [key: keyof PairingWeights, value: number]
  addPair: []
  resolveConflicts: []
  removePair: [playerA: number, playerB: number]
}>()
</script>

<template>
  <UModal
    v-model:open="open"
    title="Pesi e Vincoli Pairing"
    description="Modifica i pesi dell'algoritmo e le coppie vietate"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-6">
        <PairingWeightsSection
          :selected-preset="selectedPreset"
          :score-items="scoreItems"
          @select-preset="preset => emit('selectPreset', preset)"
          @update-weight="(key, value) => emit('updateWeight', key, value)"
        />

        <ForbiddenPairsSection
          v-model:pair-player-a="pairPlayerAModel"
          v-model:pair-player-b="pairPlayerBModel"
          :player-options="playerOptions"
          :forbidden-pairs-display="forbiddenPairsDisplay"
          :can-add-forbidden-pair="canAddForbiddenPair"
          :pairing-storage-key="pairingStorageKey"
          @add-pair="emit('addPair')"
          @resolve-conflicts="emit('resolveConflicts')"
          @remove-pair="(playerA, playerB) => emit('removePair', playerA, playerB)"
        />
      </div>
    </template>
  </UModal>
</template>
