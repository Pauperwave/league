<!-- app\pages\rulesets.vue -->
<script setup lang="ts">

const { t } = useI18n()

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

const breadcrumbItems = useBreadcrumb(() => [
  { label: t('ruleset.breadcrumb') },
])

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
  { icon: ICONS.player,   tooltip: t('ruleset.actionTooltips.partecipation'), label: t('ruleset.actions.partecipation'), key: 'rule_set_partecipation' },
  { icon: ICONS.ruleKill, tooltip: t('ruleset.actionTooltips.kill'),          label: t('ruleset.actions.kill'),          key: 'rule_set_kill' },
  { icon: ICONS.ruleBrew, tooltip: t('ruleset.actionTooltips.brew'),          label: t('ruleset.actions.brew'),          key: 'rule_set_brew' },
  { icon: ICONS.play,     tooltip: t('ruleset.actionTooltips.play'),          label: t('ruleset.actions.play'),          key: 'rule_set_play' },
] as const
</script>

<template>
  <ListPageShell
    :breadcrumb-items="breadcrumbItems"
    :title="t('ruleset.pageTitle')"
    :add-label="t('ruleset.newRuleset')"
    :error="error"
    :error-message="errorMessage"
    :loading="shouldShowLoading"
    @add="handleEditClick(null)"
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
              <UIcon :name="ICONS.rules" class="text-primary" />
              <h2 class="text-lg font-semibold flex-1">
                {{ ruleset.name }}
              </h2>

              <UButton
                color="neutral"
                variant="ghost"
                :icon="ICONS.edit"
                size="sm"
                :aria-label="t('ruleset.editAriaLabel')"
                @click="handleEditClick(ruleset)"
              />

              <UTooltip
                :text="isRulesetInUse(ruleset.ruleset_id)
                  ? t('ruleset.viewLeaguesInUseTooltip')
                  : t('ruleset.viewLeaguesNotInUseTooltip')"
              >
                <UButton
                  color="primary"
                  variant="ghost"
                  :icon="ICONS.standings"
                  size="sm"
                  :aria-label="t('ruleset.viewLeaguesAriaLabel')"
                  @click="openLeaguesModal(ruleset)"
                >
                  {{ getLeaguesByRuleset(ruleset.ruleset_id).length }}
                </UButton>
              </UTooltip>

              <UTooltip
                :text="isRulesetInUse(ruleset.ruleset_id)
                  ? t('ruleset.deleteInUseTooltip')
                  : t('ruleset.deleteTooltip')"
              >
                <UButton
                  color="error"
                  variant="ghost"
                  :icon="ICONS.delete"
                  size="sm"
                  :aria-label="t('ruleset.deleteAriaLabel')"
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
                {{ t('ruleset.positions') }}
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
                    <span class="text-xs">{{ t('ruleset.pointsUnit') }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Action Points -->
            <div class="flex-1 flex flex-col">
              <div class="text-sm font-semibold mb-2 text-center text-default">
                {{ t('ruleset.actionsHeading') }}
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
                      <UTooltip :text="t('ruleset.validEventsTooltip')">
                        <span class="cursor-help text-default">{{ t('ruleset.validEventsRow') }}</span>
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

    <template #extra>
      <RulesetFormModal
        v-model:open="showFormModal"
        :ruleset="rulesetToEdit"
        @create="handleCreateRuleset"
        @update="handleUpdateRuleset"
      />

      <ConfirmModal
        v-model:open="showDeleteConfirm"
        :description="t('ruleset.confirmDeleteDescription')"
        :question="t('ruleset.confirmDeleteQuestion')"
        :subject="rulesetToDelete?.name"
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
    </template>
  </ListPageShell>
</template>
