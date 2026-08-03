<!-- app\components\tournament\pairing\table\PairingActionButton.vue -->
<!-- Shared shape behind PairingTableActions.vue's three action buttons
     (ranking/kills/draw): a top tooltip wrapping an outline UButton that
     fills its flex slot. -->
<script setup lang="ts">
import type { IconName } from '~/utils/icons'
import type { SemanticColor } from '~/utils/semanticColor'

const {
  tooltipText,
  color,
  icon,
  disabled,
  label
} = defineProps<{
  tooltipText: string
  color: SemanticColor | 'neutral'
  icon: IconName
  disabled: boolean
  label: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <UTooltip :content="{ side: 'top' }" :text="tooltipText">
    <UButton
      :color="color"
      class="flex-1"
      :icon="icon"
      variant="outline"
      :disabled="disabled"
      @click="emit('click')"
    >
      {{ label }}
    </UButton>
  </UTooltip>
</template>
