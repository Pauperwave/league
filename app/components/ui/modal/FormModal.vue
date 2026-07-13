<!-- app\components\ui\FormModal.vue -->
<script setup lang="ts">
interface Props {
  title: string
  description: string
  icon: string
  submitLabel: string
  formId: string
  disabled?: boolean
  submitIcon?: string
}

const { title, description, icon, submitLabel, formId, disabled = false, submitIcon } = defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  cancel: []
}>()
</script>

<template>
  <UModal
    v-model:open="open"
    :description="description"
    :ui="{ footer: 'justify-between' }"
  >
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon :name="icon" class="text-primary" />
        <span>{{ title }}</span>
      </div>
    </template>

    <template #body>
      <slot />
    </template>

    <template #footer>
      <CancelButton @click="emit('cancel')" />
      <UButton
        type="submit"
        :form="formId"
        color="primary"
        :trailing-icon="submitIcon"
        :disabled="disabled"
      >
        {{ submitLabel }}
      </UButton>
    </template>
  </UModal>
</template>
