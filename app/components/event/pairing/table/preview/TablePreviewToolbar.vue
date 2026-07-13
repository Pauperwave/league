<!-- app\components\event\pairing\table\preview\TablePreviewToolbar.vue -->
<script setup lang="ts">
// fallow-ignore-file code-duplication -- toolbar button markup coincidentally matches WaitingListTable's unrelated bulk-action toolbar
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
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
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-sm text-muted">
      {{ t('event.tablePreviewToolbar.totalScoreLabel') }} <span class="font-semibold text-default">{{ totalScore.toFixed(2) }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton size="sm" color="neutral" variant="soft" :icon="ICONS.settings" @click="emit('openSettings')">
        {{ t('event.tablePreviewToolbar.weightsAndConstraints') }}
      </UButton>
      <UButton size="sm" color="neutral" variant="outline" :icon="ICONS.shuffle" :disabled="loading" @click="emit('optimize')">
        {{ t('event.tablePreviewToolbar.optimize') }}
      </UButton>
    </div>
  </div>
</template>
