<!-- app/components/ui/layout/ListPageShell.vue -->
<script setup lang="ts">
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
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="p-6 pb-0">
      <UBreadcrumb :items="breadcrumbItems" />
    </div>

    <div class="p-6 pt-4">
      <PageHeaderRow :title="title">
        <UButton color="primary" :icon="ICONS.add" @click="emit('add')">
          {{ addLabel }}
        </UButton>
      </PageHeaderRow>
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
