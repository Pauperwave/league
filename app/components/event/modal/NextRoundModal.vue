<!-- app\components\event\modal\NextRoundModal.vue -->
<script setup lang="ts">

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  confirm: []
}>()

const { t } = useI18n()

function handleCancel() {
  open.value = false
}

function handleConfirm() {
  emit('confirm')
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('event.nextRoundModal.title')"
    :description="t('event.nextRoundModal.description')"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer>
      <ModalFooterActions
        :confirm-label="t('common.confirm')"
        @cancel="handleCancel"
        @confirm="handleConfirm"
      />
    </template>
  </UModal>
</template>
