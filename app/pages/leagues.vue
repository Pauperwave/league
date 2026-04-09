<script setup lang="ts">
import { useLeagues } from '~/composables/supabase/useLeagues'


// Also worth considering: if LeagueTable can receive a loading prop to show skeletons on re-fetches (without destroying/recreating the component), that would be a nicer UX than the full v-if/v-else approach — but that's a bigger refactor.

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
  navigateToLeague
} = useLeagues()
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="p-6 pb-0">
      <Breadcrumb
        :items="[
          { label: 'Home', to: '/', icon: 'i-lucide-home' },
          { label: 'Leghe' }
        ]"
      />
    </div>

    <div class="flex items-center justify-between p-6 pt-4">
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-arrow-left"
        to="/"
      >
        Home
      </UButton>
      <h1 class="text-2xl font-bold">
        Leghe
      </h1>
      <div class="flex items-center gap-2">
        <UButton
          color="primary"
          icon="i-lucide-plus"
          @click="showCreateModal = true"
        >
          Nuova Lega
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      :title="errorMessage"
      class="mx-6 mb-4"
    />

    <div
      v-if="rulesetsLoading"
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
        @view="navigateToLeague"
        @delete="handleDeleteLeague"
      />
    </div>

    <LeagueFormModal
      v-model:open="showCreateModal"
      :league="null"
      :rulesets="rulesets || []"
      :rulesets-loading="rulesetsLoading"
      @create="handleCreateLeague"
    />

    <ConfirmModal
      v-model:open="showDeleteConfirm"
      title="Conferma Eliminazione"
      description="Stai per eliminare una lega"
      question="Sei sicuro di voler eliminare la lega"
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
