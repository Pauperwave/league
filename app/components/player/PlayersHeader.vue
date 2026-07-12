<!-- app\components\players\PlayersHeader.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
defineEmits<{ createPlayer: [] }>()

const { t } = useI18n()

const breadcrumbItems = computed(() => [
  { label: t('common.home'), to: '/' },
  { label: t('player.breadcrumb') }
])
</script>

<template>
  <div class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" />
    <div class="flex items-center justify-between">
      <UButton color="neutral" :icon="ICONS.back" to="/">
        {{ t('common.home') }}
      </UButton>
      <h1 class="text-2xl font-bold">
        {{ t('player.pageTitle') }}
      </h1>
      <UButton :icon="ICONS.addPlayer" color="primary" @click="$emit('createPlayer')">
        {{ t('player.newPlayer') }}
      </UButton>
    </div>
  </div>
</template>
