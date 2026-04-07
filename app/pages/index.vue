<script setup lang="ts">
import { useLeagues } from '~/composables/supabase/useLeagues'
import type { League } from '#shared/utils/types'

const {
  rulesets,
  rulesetsLoading,
  leagues,
  loading,
  error,
  errorMessage,
  showCreateModal,
  leagueToDelete,
  showDeleteConfirm,
  handleCreateLeague,
  handleDeleteLeague,
  confirmDeleteLeague,
  navigateToLeague
} = useLeagues()

function handleView(league: League) {
  navigateToLeague(league)
}

function handleDelete(league: League) {
  handleDeleteLeague(league)
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="p-6 pb-0">
      <Breadcrumb
        :items="[{ label: 'Home', icon: 'i-lucide-home' }]"
      />
    </div>
    <div class="flex items-center justify-between p-6 pt-4">
      <h1 class="text-2xl font-bold">
        Leghe
      </h1>
      <UButton
        color="primary"
        icon="i-lucide-plus"
        @click="showCreateModal = true"
      >
        Nuova Lega
      </UButton>
    </div>

    <LazyUAlert
      v-if="error"
      color="error"
      :title="errorMessage"
      class="mx-6 mb-4"
    />

    <div
      v-if="loading"
      class="flex items-center justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin text-4xl text-primary"
      />
    </div>

    <div
      v-else
      class="p-6"
    >
      <LeagueTable
        :leagues="leagues"
        :rulesets="rulesets || []"
        :loading="loading"
        @view="handleView"
        @delete="handleDelete"
      />
    </div>

    <CreateLeagueModal
      v-model:open="showCreateModal"
      :rulesets="rulesets || []"
      :rulesets-loading="rulesetsLoading"
      @create="handleCreateLeague"
    />

    <ConfirmModal
      v-model:open="showDeleteConfirm"
      title="Conferma Eliminazione"
      description="Stai per eliminare una lega"
      question="Sei sicuro di voler eliminare questa lega?"
      :subject="leagueToDelete?.name"
      warning="Questa azione non può essere annullata."
      confirm-label="Elimina"
      cancel-label="Annulla"
      confirm-icon="i-lucide-trash-2"
      confirm-color="error"
      @confirm="confirmDeleteLeague"
    />
  </div>
</template>
