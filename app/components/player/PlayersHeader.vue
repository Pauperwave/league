<!-- app\components\player\PlayersHeader.vue -->
<script setup lang="ts">
defineEmits<{ createPlayer: [] }>()

const { t } = useI18n()

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('player.breadcrumb') }
])

// Colada cache (ADR-015) — shared with the page, no refetch
const { data: playersData } = usePlayersQuery()
const totalPlayersCount = computed(() => playersData.value?.length ?? 0)
const activePlayersCount = computed(() => (playersData.value ?? []).filter(p => p.is_active).length)
</script>

<template>
  <div class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" />
    <PageHeaderRow :title="t('player.pageTitle')">
      <UButton :icon="ICONS.addPlayer" color="primary" @click="$emit('createPlayer')">
        {{ t('player.newPlayer') }}
      </UButton>
    </PageHeaderRow>
    <p class="text-sm text-muted text-center">
      {{ t('player.countSubtitle', { total: totalPlayersCount, active: activePlayersCount }) }}
    </p>
  </div>
</template>
