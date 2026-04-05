<script setup lang="ts">
interface Props {
  label?: string
  icon?: string
  loading?: boolean
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  label: 'Annulla',
  icon: 'i-lucide-undo-2',
  loading: false,
  disabled: false
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <UButton
    color="neutral"
    variant="outline"
    :trailing-icon="icon"
    :loading="loading"
    :disabled="disabled"
    @click="emit('click')"
  >
    {{ label }}
  </UButton>
</template>
