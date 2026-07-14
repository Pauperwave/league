<!-- app\components\ui\actions\RowActionButton.vue -->
<script setup lang="ts">
import type { ActionType } from '~/utils/actionButton'

const { t } = useI18n()

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
const label = computed(() => t(config.value.labelKey))
</script>

<template>
  <UButton
    :color="config.color"
    :icon="config.icon"
    :size="size"
    :variant="variant"
    :disabled="disabled"
    :loading="loading"
    :aria-label="ariaLabel ?? label"
  />
</template>
