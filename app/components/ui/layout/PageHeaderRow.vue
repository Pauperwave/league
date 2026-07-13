<!-- app/components/ui/layout/PageHeaderRow.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'

interface Props {
  title: string
}

defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <div class="flex items-center justify-between">
    <UButton color="neutral" :icon="ICONS.back" to="/">
      {{ t('common.home') }}
    </UButton>
    <h1 class="text-2xl font-bold">
      {{ title }}
    </h1>
    <slot />
  </div>
</template>
