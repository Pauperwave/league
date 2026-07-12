<!-- app\pages\rulesets.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

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
  confirmDeleteRuleset,
} = useRulesets()

const openLeaguesModalLogging = useButtonLogging('Open Leagues Modal')

const breadcrumbItems = [
  { label: 'Home', to: '/', icon: ICONS.home },
  { label: 'Regolamenti' },
]

// Avoid flickering the spinner on background refreshes
const shouldShowLoading = computed(() => loading.value && rulesets.value.length === 0)

// — Leagues-using-ruleset modal —
const showLeaguesModal = ref(false)
const selectedRulesetForLeagues = ref<{ id: number; name: string } | null>(null)

function openLeaguesModal(ruleset: { ruleset_id: number; name: string }) {
  openLeaguesModalLogging.logClick()
  selectedRulesetForLeagues.value = { id: ruleset.ruleset_id, name: ruleset.name }
  showLeaguesModal.value = true
}

// — Helpers —
function formatScore(score: number | null | undefined): string {
  return score?.toString() ?? '-'
}

const RANK_STYLES = [
  'bg-primary/40',
  'bg-primary/25',
  'bg-primary/15',
  'bg-primary/5',
] as const

const ACTION_ROWS = [
  { icon: ICONS.player,           tooltip: "Punti per partecipare all'evento",      label: 'Partecipazione', key: 'rule_set_partecipation' },
  { icon: ICONS.ruleKill,          tooltip: 'Punti per aver eliminato un avversario', label: 'Kill',           key: 'rule_set_kill' },
  { icon: ICONS.ruleBrew,           tooltip: 'Punti per originalità del deck',         label: 'Brew',           key: 'rule_set_brew' },
  { icon: ICONS.play,           tooltip: 'Punti per la miglior giocata',           label: 'Play',           key: 'rule_set_play' },
] as const
</script>

<template>
  <div class="min-h-screen bg-default">
    <div class="p-6 pb-0">
      <UBreadcrumb :items="breadcrumbItems" />
    </div>

    <div class="flex items-center justify-between p-6 pt-4">
      <UButton color="neutral" :icon="ICONS.back" to="/">
        Home
      </UButton>
      <h1 class="text-2xl font-bold">
        Regolamenti e Punteggi
      </h1>
      <UButton color="primary" :icon="ICONS.add" @click="handleEditClick(null)">
        Nuovo Regolamento
      </UButton>
    </div>

    <UAlert v-if="error" color="error" :title="errorMessage" class="mx-6 mb-4" />

    <div v-if="shouldShowLoading" class="flex items-center justify-center py-12">
      <UIcon :name="ICONS.loading" class="animate-spin text-4xl text-primary" />
    </div>

    <div v-else class="p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <UCard
          v-for="ruleset in rulesets"
          :key="ruleset.ruleset_id"
          class="overflow-hidden"
          :ui="{ body: 'p-3' }"
        >
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon :name="ICONS.rules" class="text-primary" />
              <h2 class="text-lg font-semibold flex-1">
                {{ ruleset.name }}
              </h2>

              <UButton
                color="neutral"
                variant="ghost"
                :icon="ICONS.edit"
                size="sm"
                aria-label="Modifica regolamento"
                @click="handleEditClick(ruleset)"
              />

              <UTooltip
                :text="isRulesetInUse(ruleset.ruleset_id)
                  ? 'Vedi leghe che usano questo regolamento'
                  : 'Nessuna lega usa questo regolamento'"
              >
                <UButton
                  color="primary"
                  variant="ghost"
                  :icon="ICONS.standings"
                  size="sm"
                  aria-label="Leghe che usano questo regolamento"
                  @click="openLeaguesModal(ruleset)"
                >
                  {{ getLeaguesByRuleset(ruleset.ruleset_id).length }}
                </UButton>
              </UTooltip>

              <UTooltip
                :text="isRulesetInUse(ruleset.ruleset_id)
                  ? 'Regolamento in uso da almeno una lega'
                  : 'Elimina regolamento'"
              >
                <UButton
                  color="error"
                  variant="ghost"
                  :icon="ICONS.delete"
                  size="sm"
                  aria-label="Elimina regolamento"
                  :disabled="isRulesetInUse(ruleset.ruleset_id)"
                  @click="handleDeleteClick(ruleset)"
                />
              </UTooltip>
            </div>
          </template>

          <div class="flex gap-4">
            <!-- Positions -->
            <div class="w-20 shrink-0">
              <div class="text-sm font-semibold mb-1 text-center text-default">
                Posizioni
              </div>
              <div class="space-y-1">
                <div
                  v-for="(style, i) in RANK_STYLES"
                  :key="i"
                  :class="[style, 'rounded p-1.5 text-center']"
                >
                  <UIcon :name="ICONS.victories" class="size-3 text-primary mx-auto mb-0.5" />
                  <div class="text-sm font-semibold">
                    {{ formatScore(ruleset[`rule_set_rank${i + 1}` as keyof typeof ruleset] as number | null) }}
                    <span class="text-xs">pt</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Action Points -->
            <div class="flex-1 flex flex-col">
              <div class="text-sm font-semibold mb-2 text-center text-default">
                Azioni
              </div>
              <table class="w-full text-sm">
                <tbody class="divide-y divide-default/30">
                  <tr v-for="row in ACTION_ROWS" :key="row.key">
                    <td class="py-2 flex items-center gap-2">
                      <UIcon :name="row.icon" class="size-4 text-default" />
                      <UTooltip :text="row.tooltip">
                        <span class="cursor-help text-default">{{ row.label }}</span>
                      </UTooltip>
                    </td>
                    <td class="py-2 text-right font-semibold pl-4">
                      {{ formatScore(ruleset[row.key] as number | null) }}
                    </td>
                  </tr>
                  <tr v-if="ruleset.rule_set_valid_events">
                    <td class="py-2 flex items-center gap-2">
                      <UIcon :name="ICONS.calendarConfirmed" class="size-4 text-default" />
                      <UTooltip text="Minimo eventi per la classifica finale">
                        <span class="cursor-help text-default">Eventi validi</span>
                      </UTooltip>
                    </td>
                    <td class="py-2 text-right font-semibold pl-4">
                      {{ ruleset.rule_set_valid_events }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Modals -->
    <RulesetFormModal
      v-model:open="showFormModal"
      :ruleset="rulesetToEdit"
      @create="handleCreateRuleset"
      @update="handleUpdateRuleset"
    />

    <ConfirmModal
      v-model:open="showDeleteConfirm"
      title="Conferma Eliminazione"
      description="Stai per eliminare un regolamento"
      question="Sei sicuro di voler eliminare il regolamento"
      :subject="rulesetToDelete?.name"
      warning="Questa azione non può essere annullata."
      confirm-label="Elimina"
      cancel-label="Annulla"
      :confirm-icon="ICONS.delete"
      confirm-color="error"
      @confirm="confirmDeleteRuleset"
    />

    <LeaguesUsingRulesetModal
      v-model:open="showLeaguesModal"
      :ruleset-id="selectedRulesetForLeagues?.id ?? 0"
      :ruleset-name="selectedRulesetForLeagues?.name ?? ''"
      :get-leagues-by-ruleset="getLeaguesByRuleset"
    />
  </div>
</template>
