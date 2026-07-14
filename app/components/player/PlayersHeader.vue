<!-- app\components\player\PlayersHeader.vue -->
<script setup lang="ts">
defineEmits<{ createPlayer: [] }>()

const { t } = useI18n()

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('player.breadcrumb') }
])
</script>

<template>
  <div class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" />
    <PageHeaderRow :title="t('player.pageTitle')">
      <UButton :icon="ICONS.addPlayer" color="primary" @click="$emit('createPlayer')">
        {{ t('player.newPlayer') }}
      </UButton>
    </PageHeaderRow>
  </div>
</template>
