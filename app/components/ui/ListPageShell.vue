<!-- app\components\ui\ListPageShell.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'

interface BreadcrumbItem {
  label: string
  to?: string
  icon?: string
}

interface Props {
  breadcrumbItems: BreadcrumbItem[]
  title: string
  addLabel: string
  error?: unknown
  errorMessage?: string
  loading?: boolean
}

const { breadcrumbItems, title, addLabel, error = null, errorMessage = '', loading = false } = defineProps<Props>()

const emit = defineEmits<{
  add: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="p-6 pb-0">
      <UBreadcrumb :items="breadcrumbItems" />
    </div>

    <div class="flex items-center justify-between p-6 pt-4">
      <UButton color="neutral" :icon="ICONS.back" to="/">
        {{ t('common.home') }}
      </UButton>
      <h1 class="text-2xl font-bold">
        {{ title }}
      </h1>
      <UButton color="primary" :icon="ICONS.add" @click="emit('add')">
        {{ addLabel }}
      </UButton>
    </div>

    <UAlert v-if="error" color="error" :title="errorMessage" class="mx-6 mb-4" />

    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon :name="ICONS.loading" class="animate-spin text-4xl text-primary" />
    </div>

    <div v-else class="p-6">
      <slot />
    </div>

    <slot name="extra" />
  </div>
</template>
