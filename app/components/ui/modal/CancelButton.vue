<!-- app\components\ui\modal\CancelButton.vue -->
<script setup lang="ts">

const { t } = useI18n()

const {
  label,
  icon = ICONS.undo,
  showIcon = true,
  variant,
  loading = false,
  disabled = false,
} = defineProps<{
  label?: string
  icon?: string
  showIcon?: boolean
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const displayLabel = computed(() => label ?? t('common.cancel'))

const clickLogging = useButtonLogging('Cancel Button', { label: () => displayLabel.value })

function handleClick() {
  clickLogging.logClick()
  emit('click')
}
</script>

<template>
  <UButton
    color="neutral"
    :variant="variant"
    :trailing-icon="showIcon ? icon : undefined"
    :loading="loading"
    :disabled="disabled"
    @click="handleClick"
  >
    {{ displayLabel }}
  </UButton>
</template>
