<!-- app\components\payments\RegistrationTrendChart.vue -->
<script setup lang="ts">
/** Registration count per tournament, oldest → newest — a per-tappa attendance trend only makes sense chronologically within one league. */
import type { PaymentRow } from './types'

const { rows } = defineProps<{ rows: PaymentRow[] }>()

const { t } = useI18n()
const { colors, tooltipTheme } = useChartTheme()

const option = computed<ECOption>(() => {
  const byTournament = new Map<number, { name: string; date: string | null; count: number }>()
  for (const row of rows) {
    const existing = byTournament.get(row.tournamentId)
    if (existing) existing.count++
    else byTournament.set(row.tournamentId, { name: row.tournamentName, date: row.tournamentDate, count: 1 })
  }
  const sorted = [...byTournament.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const lineColor = colors.value.palette[0]

  return {
    tooltip: { trigger: 'axis', ...tooltipTheme.value },
    grid: { left: 8, right: 16, top: 24, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: sorted.map(entry => entry.name),
      axisLabel: { color: colors.value.textSecondary },
      axisLine: { lineStyle: { color: colors.value.textSecondary } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: colors.value.textSecondary },
      splitLine: { lineStyle: { color: colors.value.splitLine } },
    },
    series: [{
      type: 'line',
      data: sorted.map(entry => entry.count),
      smooth: true,
      symbolSize: 8,
      itemStyle: { color: lineColor },
      areaStyle: { color: lineColor, opacity: 0.1 },
    }],
  }
})
</script>

<template>
  <div class="bg-elevated rounded-xl border border-default p-4 space-y-2">
    <h3 class="text-sm font-semibold text-muted">{{ t('payments.overview.trendChartTitle') }}</h3>
    <BaseChart :option="option" height="16rem" />
  </div>
</template>
