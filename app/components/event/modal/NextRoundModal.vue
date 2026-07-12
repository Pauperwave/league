<!-- app\components\Events\NextRoundModal.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  confirm: []
}>()

const { t } = useI18n()

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
    :title="t('event.nextRoundModal.title')"
    :description="t('event.nextRoundModal.description')"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer>
      <UButton color="neutral" variant="ghost" @click="handleCancel">
        {{ t('common.cancel') }}
      </UButton>
      <UButton color="primary" @click="handleConfirm">
        {{ t('common.confirm') }}
      </UButton>
    </template>
  </UModal>
</template>
