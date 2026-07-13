<!-- app\components\ui\modal\ConfirmModal.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const {
  title,
  description,
  question,
  subject = '',
  warning,
  confirmLabel,
  cancelLabel,
  confirmIcon = ICONS.confirm,
  cancelIcon = ICONS.undo,
  loading = false,
  dismissible = true,
} = defineProps<{
  title?: string
  description: string
  question: string
  subject?: string
  warning?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmIcon?: string
  cancelIcon?: string
  loading?: boolean
  dismissible?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
  afterLeave: []
}>()

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()

const displayTitle = computed(() => title ?? t('common.confirmDeleteTitle'))
const displayWarning = computed(() => warning ?? t('common.confirmDeleteWarning'))
const displayConfirmLabel = computed(() => confirmLabel ?? t('common.delete'))
const displayCancelLabel = computed(() => cancelLabel ?? t('common.cancel'))

const confirmLogging = useButtonLogging('Confirm Modal', { title: () => displayTitle.value, subject: () => subject })
const cancelLogging = useButtonLogging('Cancel Modal', { title: () => displayTitle.value })

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
    :title="displayTitle"
    :description="description"
    :dismissible="dismissible && !loading"
    :ui="{ footer: 'justify-between' }"
    @after:leave="$emit('afterLeave')"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon
          :name="ICONS.warning"
          class="text-warning"
        />
        <span>{{ displayTitle }}</span>
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
        v-if="displayWarning"
        class="text-warning font-semibold mt-2"
      >
        {{ displayWarning }}
      </p>
    </template>

    <template #footer>
      <UButton
        color="error"
        :icon="confirmIcon"
        :loading="loading"
        @click="onConfirm"
      >
        {{ displayConfirmLabel }}
      </UButton>
      <CancelButton
        :label="displayCancelLabel"
        :icon="cancelIcon"
        :disabled="loading"
        @click="onCancel"
      />
    </template>
  </UModal>
</template>
