<!-- app\components\ui\CancelButton.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const { t } = useI18n()

const {
  label,
  icon = ICONS.undo,
  loading = false,
  disabled = false,
} = defineProps<{
  label?: string
  icon?: string
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const displayLabel = computed(() => label ?? t('common.cancel'))

const clickLogging = useButtonLogging('Cancel Button', { label: () => displayLabel.value })

function handleClick() {
  clickLogging.logClick()
  emit('click')
}
</script>

<template>
  <UButton
    color="neutral"
    :trailing-icon="icon"
    :loading="loading"
    :disabled="disabled"
    @click="handleClick"
  >
    {{ displayLabel }}
  </UButton>
</template>
