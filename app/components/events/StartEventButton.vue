<!-- app\components\Events\StartEventButton.vue -->
<script setup lang="ts">
interface Props {
  disabled?: boolean
  loading?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <UButton
    color="primary"
    size="lg"
    block
    :loading="loading"
    icon="i-lucide-play"
    @click="!disabled && emit('click')"
  >
    Avvia Evento
  </UButton>
</template>
