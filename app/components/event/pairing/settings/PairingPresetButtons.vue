<!-- app\components\events\Pairings\Settings\PairingPresetButtons.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
export type PairingPresetKind = 'balanced' | 'social' | 'competitive' | 'reset' | 'custom'

defineProps<{
  selected: PairingPresetKind
}>()

const emit = defineEmits<{
  select: [preset: Exclude<PairingPresetKind, 'custom'>]
}>()

const presets: Array<{ key: Exclude<PairingPresetKind, 'custom' | 'reset'>; label: string; icon: string }> = [
  { key: 'social', label: 'Sociale', icon: ICONS.players },
  { key: 'balanced', label: 'Bilanciato', icon: ICONS.rules },
  { key: 'competitive', label: 'Competitivo', icon: ICONS.standings },
]
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UFieldGroup>
      <UButton
        v-for="option in presets"
        :key="option.key"
        :icon="option.icon"
        :color="selected === option.key ? 'primary' : 'neutral'"
        :variant="selected === option.key ? 'soft' : 'outline'"
        @click="emit('select', option.key)"
      >
        {{ option.label }}
      </UButton>
    </UFieldGroup>

    <UButton
      :icon="ICONS.reset"
      color="warning"
      variant="soft"
      @click="emit('select', 'reset')"
    >
      Reset
    </UButton>

    <UButton
      :icon="ICONS.filters"
      :color="selected === 'custom' ? 'primary' : 'neutral'"
      :variant="selected === 'custom' ? 'soft' : 'outline'"
      class="pointer-events-none select-none"
    >
      Personalizzato
    </UButton>
  </div>
</template>
