<!-- app\components\ui\modal\ModalFooterActions.vue -->
<script setup lang="ts">
const {
  confirmLabel,
  confirmDisabled = false,
  confirmLoading = false,
  cancelLabel,
  cancelDisabled = false
} = defineProps<{
  confirmLabel: string
  confirmDisabled?: boolean
  confirmLoading?: boolean
  cancelLabel?: string
  cancelDisabled?: boolean
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()
</script>

<template>
  <div class="flex items-center justify-between gap-2 w-full">
    <div>
      <slot name="start" />
    </div>
    <div class="flex gap-2 justify-end">
      <CancelButton
        :label="cancelLabel"
        variant="outline"
        :disabled="cancelDisabled"
        @click="emit('cancel')"
      />
      <ConfirmButton
        :label="confirmLabel"
        :loading="confirmLoading"
        :disabled="confirmDisabled"
        @click="emit('confirm')"
      />
    </div>
  </div>
</template>
