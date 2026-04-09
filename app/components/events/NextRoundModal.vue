<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  confirm: []
}>()
</script>

<template>
  <UModal
    v-model:open="open"
    title="Prossimo Round"
    description="Procedere al prossimo round?"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer>
      <UButton color="neutral" variant="ghost" @click="open = false">
        Annulla
      </UButton>
      <UButton color="primary" @click="emit('confirm')">
        Conferma
      </UButton>
    </template>
  </UModal>
</template>
