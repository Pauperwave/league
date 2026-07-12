<!-- app\components\ui\CancelButton.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const {
  label = 'Annulla',
  icon = ICONS.undo,
  loading = false,
  disabled = false,
} = defineProps<{
  label?: string
  icon?: string
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const clickLogging = useButtonLogging('Cancel Button', { label: () => label })

function handleClick() {
  clickLogging.logClick()
  emit('click')
}
</script>

<template>
  <UButton
    color="neutral"
    :trailing-icon="icon"
    :loading="loading"
    :disabled="disabled"
    @click="handleClick"
  >
    {{ label }}
  </UButton>
</template>
