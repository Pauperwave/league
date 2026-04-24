<!-- app\components\Ui\CancelButton.vue -->
<script setup lang="ts">
import { useButtonLogging } from '~/composables/useButtonLogging'

interface Props {
  label?: string
  icon?: string
  loading?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Annulla',
  icon: 'i-lucide-undo-2',
  loading: false,
  disabled: false
})

const emit = defineEmits<{
  click: []
}>()

const clickLogging = useButtonLogging('Cancel Button', { label: () => props.label })

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
