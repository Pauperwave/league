<!-- app\components\tournament\pairing\table\preview\TablePreviewToolbar.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- toolbar button markup coincidentally matches WaitingListTable's unrelated bulk-action toolbar
const {
  totalScore,
  loading = false,
} = defineProps<{
  totalScore: number
  loading?: boolean
}>()

const emit = defineEmits<{
  openSettings: []
  optimize: []
  random: []
}>()

const { t } = useI18n()

const openSettingsLogging = useButtonLogging('Pesi e Vincoli')
const optimizeLogging = useButtonLogging('Ottimizza tavoli')
const randomLogging = useButtonLogging('Tavoli casuali')

function handleOpenSettings() {
  openSettingsLogging.logClick()
  emit('openSettings')
}

function handleOptimize() {
  optimizeLogging.logClick()
  emit('optimize')
}

function handleRandom() {
  randomLogging.logClick()
  emit('random')
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-sm text-muted">
      {{ t('tournament.tablePreviewToolbar.totalScoreLabel') }} <span class="font-semibold text-default">{{ totalScore.toFixed(2) }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UTooltip :content="{ side: 'top' }" :text="t('tournament.tablePreviewToolbar.weightsAndConstraintsTooltip')">
        <UButton size="sm" color="neutral" variant="soft" :icon="ICONS.settings" @click="handleOpenSettings">
          {{ t('tournament.tablePreviewToolbar.weightsAndConstraints') }}
        </UButton>
      </UTooltip>
      <UTooltip :content="{ side: 'top' }" :text="t('tournament.tablePreviewToolbar.optimizeTooltip')">
        <UButton size="sm" color="neutral" variant="outline" :icon="ICONS.optimize" :disabled="loading" @click="handleOptimize">
          {{ t('tournament.tablePreviewToolbar.optimize') }}
        </UButton>
      </UTooltip>
      <UTooltip :content="{ side: 'top' }" :text="t('tournament.tablePreviewToolbar.randomTooltip')">
        <UButton size="sm" color="neutral" variant="outline" :icon="ICONS.shuffle" :disabled="loading" @click="handleRandom">
          {{ t('tournament.tablePreviewToolbar.random') }}
        </UButton>
      </UTooltip>
    </div>
  </div>
</template>
