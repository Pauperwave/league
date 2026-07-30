<!-- app\components\tournament\pairing\settings\PairingPresetButtons.vue -->
<script setup lang="ts">
export type PairingPresetKind = 'balanced' | 'social' | 'competitive' | 'reset' | 'custom'

defineProps<{
  selected: PairingPresetKind
}>()

const emit = defineEmits<{
  select: [preset: Exclude<PairingPresetKind, 'custom'>]
}>()

const { t } = useI18n()

const presets: Array<{ key: Exclude<PairingPresetKind, 'custom' | 'reset'>; label: string; icon: string }> = [
  { key: 'social', label: t('tournament.pairingPresets.social'), icon: ICONS.players },
  { key: 'balanced', label: t('tournament.pairingPresets.balanced'), icon: ICONS.rules },
  { key: 'competitive', label: t('tournament.pairingPresets.competitive'), icon: ICONS.standings },
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
      {{ t('tournament.pairingPresets.reset') }}
    </UButton>

    <UButton
      :icon="ICONS.filters"
      :color="selected === 'custom' ? 'primary' : 'neutral'"
      :variant="selected === 'custom' ? 'soft' : 'outline'"
      class="pointer-events-none select-none"
    >
      {{ t('tournament.pairingPresets.custom') }}
    </UButton>
  </div>
</template>
