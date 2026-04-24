<script setup lang="ts">
export type PairingPresetKind = 'balanced' | 'social' | 'competitive' | 'reset' | 'custom'

interface Props {
  selected: PairingPresetKind
}

defineProps<Props>()

const emit = defineEmits<{
  select: [preset: Exclude<PairingPresetKind, 'custom'>]
}>()

const presets: Array<{ key: Exclude<PairingPresetKind, 'custom' | 'reset'>; label: string; icon: string }> = [
  { key: 'social', label: 'Sociale', icon: 'i-lucide-users' },
  { key: 'balanced', label: 'Bilanciato', icon: 'i-lucide-scale' },
  { key: 'competitive', label: 'Competitivo', icon: 'i-lucide-trophy' },
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
      icon="i-lucide-rotate-ccw"
      color="warning"
      variant="soft"
      @click="emit('select', 'reset')"
    >
      Reset
    </UButton>

    <UButton
      icon="i-lucide-sliders-horizontal"
      :color="selected === 'custom' ? 'primary' : 'neutral'"
      :variant="selected === 'custom' ? 'soft' : 'outline'"
      class="pointer-events-none select-none"
    >
      Personalizzato
    </UButton>
  </div>
</template>
