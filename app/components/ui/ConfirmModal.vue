<script setup lang="ts">
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

withDefaults(defineProps<Props>(), {
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

function onConfirm() {
  emit('confirm')
}

function onCancel() {
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
