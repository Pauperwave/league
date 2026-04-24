<!-- app\components\Ui\ConfirmModal.vue -->
<script setup lang="ts">
import { useButtonLogging } from '~/composables/useButtonLogging'

interface Props {
  title: string
  description: string
  question: string
  subject?: string
  warning?: string
  confirmLabel: string
  cancelLabel: string
  confirmIcon?: string
  cancelIcon?: string
  loading?: boolean
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  subject: '',
  warning: '',
  confirmIcon: 'i-lucide-check',
  cancelIcon: 'i-lucide-undo-2',
  loading: false,
  dismissible: true
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  afterLeave: []
}>()

const open = defineModel<boolean>('open', { required: true })

const confirmLogging = useButtonLogging('Confirm Modal', { title: () => props.title, subject: () => props.subject })
const cancelLogging = useButtonLogging('Cancel Modal', { title: () => props.title })

function onConfirm() {
  confirmLogging.logClick()
  emit('confirm')
}

function onCancel() {
  cancelLogging.logClick()
  open.value = false
  emit('cancel')
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="description"
    :dismissible="dismissible && !loading"
    :ui="{ footer: 'justify-between' }"
    @after:leave="$emit('afterLeave')"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-alert-triangle"
          class="text-warning"
        />
        <span>{{ title }}</span>
      </div>
    </template>

    <template #body>
      <p>
        {{ question }}
        <span
          v-if="subject"
          class="font-bold text-highlighted"
        >"{{ subject }}"</span>?
      </p>
      <p
        v-if="warning"
        class="text-warning font-semibold mt-2"
      >
        {{ warning }}
      </p>
    </template>

    <template #footer>
      <UButton
        color="error"
        :icon="confirmIcon"
        :loading="loading"
        @click="onConfirm"
      >
        {{ confirmLabel }}
      </UButton>
      <CancelButton
        :label="cancelLabel"
        :disabled="loading"
        @click="onCancel"
      />
    </template>
  </UModal>
</template>
