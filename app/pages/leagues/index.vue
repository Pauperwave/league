<!-- app\pages\leagues\index.vue -->
<script setup lang="ts">
import type { League } from '#shared/utils/types'

const { t } = useI18n()

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
} = useLeaguesPage()

const breadcrumbItems = useBreadcrumb(() => [
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

const { updateLeague } = useLeagueUpdate(() => {
  showEditModal.value = false
  leagueToEdit.value = null
})
</script>

<template>
  <ListPageShell
    :breadcrumb-items="breadcrumbItems"
    :title="t('league.breadcrumb')"
    :add-label="t('league.newLeague')"
    :error="error"
    :error-message="errorMessage"
    :loading="rulesetsLoading"
    @add="showCreateModal = true"
  >
    <LeagueTable
      :leagues="leagues"
      :rulesets="normalizedRulesets"
      @view="navigateToLeague"
      @edit="openEditLeague"
      @delete="handleDeleteLeague"
    />

    <template #extra>
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
    </template>
  </ListPageShell>
</template>
