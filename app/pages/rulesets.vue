<script setup lang="ts">
import { useRulesets } from '~/composables/supabase/useRulesets'

const {
  rulesets,
  loading,
  error,
  errorMessage,
  showFormModal,
  showDeleteConfirm,
  rulesetToEdit,
  rulesetToDelete,
  getLeaguesByRuleset,
  isRulesetInUse,
  handleCreateRuleset,
  handleEditClick,
  handleUpdateRuleset,
  handleDeleteClick,
  confirmDeleteRuleset
} = useRulesets()

// Only show loading on initial fetch, not on background refreshes
const shouldShowLoading = computed(() => loading.value && rulesets.value.length === 0)

// State for leagues using ruleset modal
const showLeaguesModal = ref(false)
const selectedRulesetForLeagues = ref<{ id: number; name: string } | null>(null)
const leaguesUsingSelected = computed(() => {
  if (!selectedRulesetForLeagues.value) return []
  return getLeaguesByRuleset(selectedRulesetForLeagues.value.id)
})

function showLeaguesUsingRuleset(ruleset: { ruleset_id: number; name: string }) {
  selectedRulesetForLeagues.value = { id: ruleset.ruleset_id, name: ruleset.name }
  showLeaguesModal.value = true
}

function formatScore(score: number | null): string {
  if (score === null || score === undefined) return '-'
  return score.toString()
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="p-6 pb-0">
      <Breadcrumb
        :items="[
          { label: 'Home', to: '/', icon: 'i-lucide-home' },
          { label: 'Regolamenti' }
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
        Regolamenti e Punteggi
      </h1>
      <div class="flex items-center gap-2">
        <UButton
          color="primary"
          icon="i-lucide-plus"
          @click="handleEditClick(null)"
        >
          Nuovo Regolamento
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
      v-if="shouldShowLoading"
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
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <UCard
          v-for="ruleset in rulesets"
          :key="ruleset.ruleset_id"
          class="overflow-hidden"
          :ui="{ body: 'p-3' }"
        >
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-scale"
                class="text-primary"
              />
              <h2 class="text-lg font-semibold">
                {{ ruleset.name }}
              </h2>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                size="sm"
                aria-label="Modifica regolamento"
                @click="handleEditClick(ruleset)"
              />
              <UTooltip
                :text="isRulesetInUse(ruleset.ruleset_id) ? 'Vedi leghe che usano questo regolamento' : 'Nessuna lega usa questo regolamento'"
              >
                <UButton
                  color="primary"
                  variant="ghost"
                  icon="i-lucide-trophy"
                  size="sm"
                  aria-label="Leghe che usano questo regolamento"
                  @click="showLeaguesUsingRuleset(ruleset)"
                >
                  {{ getLeaguesByRuleset(ruleset.ruleset_id).length }}
                </UButton>
              </UTooltip>
              <UTooltip
                :text="isRulesetInUse(ruleset.ruleset_id) ? 'Regolamento in uso da almeno una lega' : 'Elimina regolamento'"
              >
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  size="sm"
                  aria-label="Elimina regolamento"
                  :disabled="isRulesetInUse(ruleset.ruleset_id)"
                  @click="handleDeleteClick(ruleset)"
                />
              </UTooltip>
            </div>
          </template>

          <div class="flex gap-4">
            <!-- Left: Positions -->
            <div class="w-20 shrink-0">
              <div class="text-sm font-semibold mb-1 text-center text-default">
                Posizioni
              </div>
              <div class="space-y-1">
                <div class="bg-primary/40 rounded p-1.5 text-center">
                  <UIcon name="i-lucide-medal" class="size-3 text-primary mx-auto mb-0.5" />
                  <div class="text-sm font-semibold">{{ formatScore(ruleset.rule_set_rank1) }}<span class="text-xs">pt</span></div>
                </div>
                <div class="bg-primary/25 rounded p-1.5 text-center">
                  <UIcon name="i-lucide-medal" class="size-3 text-primary mx-auto mb-0.5" />
                  <div class="text-sm font-semibold">{{ formatScore(ruleset.rule_set_rank2) }}<span class="text-xs">pt</span></div>
                </div>
                <div class="bg-primary/15 rounded p-1.5 text-center">
                  <UIcon name="i-lucide-medal" class="size-3 text-primary mx-auto mb-0.5" />
                  <div class="text-sm font-semibold">{{ formatScore(ruleset.rule_set_rank3) }}<span class="text-xs">pt</span></div>
                </div>
                <div class="bg-primary/5 rounded p-1.5 text-center">
                  <UIcon name="i-lucide-medal" class="size-3 text-primary mx-auto mb-0.5" />
                  <div class="text-sm font-semibold">{{ formatScore(ruleset.rule_set_rank4) }}<span class="text-xs">pt</span></div>
                </div>
              </div>
            </div>

            <!-- Right: Action Points Table -->
            <div class="flex-1 flex flex-col">
              <div class="text-sm font-semibold mb-2 text-center text-default">
                Azioni
              </div>
              <table class="w-full text-sm">
                <tbody class="divide-y divide-default/30">
                  <tr>
                    <td class="py-2 flex items-center gap-2">
                      <UIcon name="i-lucide-user" class="size-4 text-default" />
                      <UTooltip text="Punti per partecipare all'evento">
                        <span class="cursor-help text-default">Partecipazione</span>
                      </UTooltip>
                    </td>
                    <td class="py-2 text-right font-semibold pl-4">{{ formatScore(ruleset.rule_set_partecipation) }}</td>
                  </tr>
                  <tr>
                    <td class="py-2 flex items-center gap-2">
                      <UIcon name="i-lucide-sword" class="size-4 text-default" />
                      <UTooltip text="Punti per aver eliminato un avversario">
                        <span class="cursor-help text-default">Kill</span>
                      </UTooltip>
                    </td>
                    <td class="py-2 text-right font-semibold pl-4">{{ formatScore(ruleset.rule_set_kill) }}</td>
                  </tr>
                  <tr>
                    <td class="py-2 flex items-center gap-2">
                      <UIcon name="i-lucide-beer" class="size-4 text-default" />
                      <UTooltip text="Punti per originalità del deck">
                        <span class="cursor-help text-default">Brew</span>
                      </UTooltip>
                    </td>
                    <td class="py-2 text-right font-semibold pl-4">{{ formatScore(ruleset.rule_set_brew) }}</td>
                  </tr>
                  <tr>
                    <td class="py-2 flex items-center gap-2">
                      <UIcon name="i-lucide-play" class="size-4 text-default" />
                      <UTooltip text="Punti per la miglior giocata">
                        <span class="cursor-help text-default">Play</span>
                      </UTooltip>
                    </td>
                    <td class="py-2 text-right font-semibold pl-4">{{ formatScore(ruleset.rule_set_play) }}</td>
                  </tr>
                  <tr v-if="ruleset.rule_set_valid_events">
                    <td class="py-2 flex items-center gap-2">
                      <UIcon name="i-lucide-calendar-check" class="size-4 text-default" />
                      <UTooltip text="Minimo eventi per la classifica finale">
                        <span class="cursor-help text-default">Eventi validi</span>
                      </UTooltip>
                    </td>
                    <td class="py-2 text-right font-semibold pl-4">{{ ruleset.rule_set_valid_events }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Ruleset Form Modal (Create/Edit) -->
    <RulesetFormModal
      v-model:open="showFormModal"
      :ruleset="rulesetToEdit"
      @create="handleCreateRuleset"
      @update="handleUpdateRuleset"
    />

    <!-- Delete Confirm Modal -->
    <ConfirmModal
      v-model:open="showDeleteConfirm"
      title="Conferma Eliminazione"
      description="Stai per eliminare un regolamento"
      question="Sei sicuro di voler eliminare il regolamento"
      :subject="rulesetToDelete?.name"
      warning="Questa azione non può essere annullata."
      confirm-label="Elimina"
      cancel-label="Annulla"
      confirm-icon="i-lucide-trash-2"
      confirm-color="error"
      @confirm="confirmDeleteRuleset"
    />

    <!-- Leagues Using Ruleset Modal -->
    <LeaguesUsingRulesetModal
      v-model:open="showLeaguesModal"
      :leagues="leaguesUsingSelected"
      :ruleset-name="selectedRulesetForLeagues?.name || ''"
    />
  </div>
</template>
