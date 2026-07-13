<!-- app\components\ui\modal\ConfirmButton.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const { t } = useI18n()

const {
  label,
  type = 'button',
  form,
  trailingIcon,
  loading = false,
  disabled = false,
} = defineProps<{
  label?: string
  /** Use 'submit' + `form` to trigger a native form (e.g. FormModal's body form) instead of relying on @click. */
  type?: 'button' | 'submit'
  form?: string
  trailingIcon?: string
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const displayLabel = computed(() => label ?? t('common.confirm'))

const clickLogging = useButtonLogging('Confirm Button', { label: () => displayLabel.value })

function handleClick() {
  clickLogging.logClick()
  emit('click')
}
</script>

<template>
  <UButton
    color="primary"
    :type="type"
    :form="form"
    :trailing-icon="trailingIcon"
    :loading="loading"
    :disabled="disabled"
    @click="handleClick"
  >
    {{ displayLabel }}
  </UButton>
</template>
