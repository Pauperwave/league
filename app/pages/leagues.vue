<script setup lang="ts">
import { useLeagues } from '~/composables/supabase/useLeagues'
import type { League } from '#shared/utils/types'

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

const showEditModal = ref(false)
const leagueToEdit = ref<League | null>(null)

function handleEditLeague(league: League) {
  leagueToEdit.value = league
  showEditModal.value = true
}

const leagueStore = useLeagueStore()

async function updateLeague({ id, data }: { id: number; data: { name: string; startsAt: string | null; endsAt: string | null; rulesetId: number | null } }) {
  const result = await leagueStore.updateLeague(id, {
    name: data.name,
    starts_at: data.startsAt,
    ends_at: data.endsAt,
    ruleset_id: data.rulesetId
  })

  if (!result.success) return console.error(result.error)

  showEditModal.value = false
  leagueToEdit.value = null
}
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
        @edit="handleEditLeague"
        @delete="handleDeleteLeague"
      />
    </div>

    <!-- Create League Modal -->
    <LeagueFormModal
      v-model:open="showCreateModal"
      :league="null"
      :rulesets="rulesets || []"
      :rulesets-loading="rulesetsLoading"
      @create="handleCreateLeague"
    />

    <!-- Edit League Modal -->
    <LeagueFormModal
      v-model:open="showEditModal"
      :league="leagueToEdit"
      :rulesets="rulesets || []"
      :rulesets-loading="rulesetsLoading"
      @update="updateLeague"
    />

    <!-- Delete Confirm Modal -->
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
