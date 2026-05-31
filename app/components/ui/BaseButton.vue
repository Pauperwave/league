<!-- app\components\ui\BaseButton.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { ACTION_MAP, type ActionType } from '~/utils/actionButton'

const {
  action,
  size = 'xs',
  variant = 'outline',
  disabled = false,
  loading = false,
  ariaLabel = undefined,
} = defineProps<{
  action: ActionType
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'soft' | 'subtle'
  disabled?: boolean
  loading?: boolean
  ariaLabel?: string
}>()

const config = computed(() => ACTION_MAP[action])
</script>

<template>
  <UButton
    :color="config.color"
    :icon="config.icon"
    :size="size"
    :variant="variant"
    :disabled="disabled"
    :loading="loading"
    :aria-label="ariaLabel ?? config.label"
  />
</template>
