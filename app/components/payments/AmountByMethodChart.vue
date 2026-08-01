<!-- app\components\payments\AmountByMethodChart.vue -->
<script setup lang="ts">
/** Cash-register view: euros collected via POS vs Contanti — 'free' seats never appear, they're always €0. */
import type { PaymentRow } from './types'

const { rows } = defineProps<{ rows: PaymentRow[] }>()

const { t, n } = useI18n()
const { colors, tooltipTheme } = useChartTheme()

const option = computed<ECOption>(() => {
  let pos = 0
  let cash = 0
  for (const row of rows) {
    if (row.paymentMethod === 'pos') pos += row.amount
    else if (row.paymentMethod === 'cash') cash += row.amount
  }

  return {
    tooltip: { trigger: 'axis', formatter: (params) => Array.isArray(params) ? `${params[0]?.name}: ${n(params[0]?.value as number ?? 0, 'currency')}` : '', ...tooltipTheme.value },
    grid: { left: 8, right: 16, top: 24, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: [t(PAYMENT_METHOD_DISPLAY.pos.labelKey), t(PAYMENT_METHOD_DISPLAY.cash.labelKey)],
      axisLabel: { color: colors.value.textSecondary },
      axisLine: { lineStyle: { color: colors.value.textSecondary } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: colors.value.textSecondary, formatter: (value: number) => n(value, 'currency') },
      splitLine: { lineStyle: { color: colors.value.splitLine } },
    },
    series: [{
      type: 'bar',
      data: [
        { value: pos, itemStyle: { color: colors.value.palette[0] } },
        { value: cash, itemStyle: { color: colors.value.palette[1] } },
      ],
      barMaxWidth: 64,
      label: { show: true, position: 'top', color: colors.value.text, formatter: (p: { value?: unknown }) => n(typeof p.value === 'number' ? p.value : 0, 'currency') },
    }],
  }
})
</script>

<template>
  <div class="bg-elevated rounded-xl border border-default p-4 space-y-2">
    <h3 class="text-sm font-semibold text-muted">{{ t('payments.overview.amountChartTitle') }}</h3>
    <BaseChart :option="option" height="16rem" />
  </div>
</template>
