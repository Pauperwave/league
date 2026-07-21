<!-- app\components\event\TimerControlButton.vue -->
<script setup lang="ts">
/**
 * A single RoundTimer control button.
 * Centralizes the tooltip-vs-title + size/class switch that fullscreen mode needs:
 * a UTooltip-wrapped button outside fullscreen (hover tooltip), a bare oversized
 * button with a native `title` inside fullscreen (UTooltip doesn't fit that layout).
 */
import type { ButtonProps } from '@nuxt/ui'

defineProps<{
  icon: string
  color: ButtonProps['color']
  variant: ButtonProps['variant']
  tooltip: string
  fullscreen: boolean
  disabled?: boolean
  label?: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <UTooltip v-if="!fullscreen" :content="{ side: 'top' }" :text="tooltip">
    <UButton
      :icon="icon"
      :color="color"
      :variant="variant"
      :disabled="disabled"
      :aria-label="tooltip"
      size="md"
      @click="emit('click')"
    >
      <span v-if="label">{{ label }}</span>
    </UButton>
  </UTooltip>
  <UButton
    v-else
    :icon="icon"
    :color="color"
    :variant="variant"
    :disabled="disabled"
    size="xl"
    class="p-8 text-4xl"
    :title="tooltip"
    @click="emit('click')"
  >
    <span v-if="label" class="text-4xl">{{ label }}</span>
  </UButton>
</template>
