<!-- app\components\Events\NextRoundModal.vue -->
<script setup lang="ts">
import { useButtonLogging } from '~/composables/useButtonLogging'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  confirm: []
}>()

const cancelLogging = useButtonLogging('Cancel Next Round')
const confirmLogging = useButtonLogging('Confirm Next Round')

function handleCancel() {
  cancelLogging.logClick()
  open.value = false
}

function handleConfirm() {
  confirmLogging.logClick()
  emit('confirm')
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Prossimo Round"
    description="Procedere al prossimo round?"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer>
      <UButton color="neutral" variant="ghost" @click="handleCancel">
        Annulla
      </UButton>
      <UButton color="primary" @click="handleConfirm">
        Conferma
      </UButton>
    </template>
  </UModal>
</template>
