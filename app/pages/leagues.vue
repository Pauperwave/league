<!-- app\pages\leagues.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'
import type { League } from '#shared/utils/types'

const { t } = useI18n()

interface UpdateLeagueData {
  id: number
  data: { name: string; startsAt: string | null; endsAt: string | null; rulesetId: number | null }
}

const editLeagueLogging = useButtonLogging('Edit League')

const {
  rulesets,
  rulesetsLoading,
  leagues,
  error,
  errorMessage,
  showCreateModal,
  leagueToDelete,
  showDeleteConfirm,
  handleCreateLeague,
  handleDeleteLeague,
  confirmDeleteLeague,
  navigateToLeague,
} = useLeagues()

const leagueStore = useLeagueStore()

const breadcrumbItems = computed(() => [
  { label: t('common.home'), to: '/', icon: ICONS.home },
  { label: t('league.breadcrumb') },
])

const normalizedRulesets = computed(() => rulesets.value ?? [])

const showEditModal = ref(false)
const leagueToEdit = ref<League | null>(null)

function openEditLeague(league: League) {
  editLeagueLogging.logClick()
  leagueToEdit.value = league
  showEditModal.value = true
}

async function updateLeague({ id, data }: UpdateLeagueData) {
  const result = await leagueStore.updateLeague(id, {
    name: data.name,
    starts_at: data.startsAt,
    ends_at: data.endsAt,
    ruleset_id: data.rulesetId,
  })

  if (!result.success) return console.error(result.error)

  showEditModal.value = false
  leagueToEdit.value = null
}
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
        {{ t('league.breadcrumb') }}
      </h1>
      <UButton color="primary" :icon="ICONS.add" @click="() => { showCreateModal = true }">
        {{ t('league.newLeague') }}
      </UButton>
    </div>

    <UAlert v-if="error" color="error" :title="errorMessage" class="mx-6 mb-4" />

    <div v-if="rulesetsLoading" class="flex items-center justify-center py-12">
      <UIcon :name="ICONS.loading" class="animate-spin text-4xl text-primary" />
    </div>

    <div v-else class="p-6">
      <LeagueTable
        :leagues="leagues"
        :rulesets="normalizedRulesets"
        @view="navigateToLeague"
        @edit="openEditLeague"
        @delete="handleDeleteLeague"
      />
    </div>

    <!-- Modals -->
    <LeagueFormModal
      v-model:open="showCreateModal"
      :league="null"
      :rulesets="normalizedRulesets"
      :rulesets-loading="rulesetsLoading"
      @create="handleCreateLeague"
    />

    <LeagueFormModal
      v-model:open="showEditModal"
      :league="leagueToEdit"
      :rulesets="normalizedRulesets"
      :rulesets-loading="rulesetsLoading"
      @update="updateLeague"
    />

    <ConfirmModal
      v-model:open="showDeleteConfirm"
      :description="t('league.confirmDeleteDescription')"
      :question="t('league.confirmDeleteQuestion')"
      :subject="leagueToDelete?.name"
      :confirm-icon="ICONS.delete"
      confirm-color="error"
      @confirm="confirmDeleteLeague"
    />
  </div>
</template>
