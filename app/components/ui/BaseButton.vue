<script setup lang="ts">
import { ACTION_MAP, type ActionType } from '~/utils/actionButton'

const props = withDefaults(defineProps<{
  action: ActionType
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'ghost' | 'link' | 'soft' | 'subtle'
  disabled?: boolean
  loading?: boolean
  ariaLabel?: string
}>(), {
  size: 'xs',
  variant: 'outline',
  disabled: false,
  loading: false,
  ariaLabel: undefined,
})

const config = computed(() => ACTION_MAP[props.action])
</script>

<template>
  <UButton
    :color="config.color"
    :icon="config.icon"
    :size="props.size"
    :variant="props.variant"
    :disabled="props.disabled"
    :loading="props.loading"
    :aria-label="props.ariaLabel ?? config.label"
  />
</template>
