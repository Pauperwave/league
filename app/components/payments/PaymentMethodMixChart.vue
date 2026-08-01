<!-- app\components\payments\PaymentMethodMixChart.vue -->
<script setup lang="ts">
/** How registrants paid — POS/Contanti/Omaggio headcount, mirrors the commander page's win-rate donut (BaseChart + useChartTheme). */
import type { PaymentRow } from './types'

const { rows } = defineProps<{ rows: PaymentRow[] }>()

const { t } = useI18n()
const { colors, tooltipTheme } = useChartTheme()

const option = computed<ECOption>(() => {
  let pos = 0
  let cash = 0
  let free = 0
  for (const row of rows) {
    if (row.paymentMethod === 'pos') pos++
    else if (row.paymentMethod === 'cash') cash++
    else if (row.paymentMethod === 'free') free++
  }

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', ...tooltipTheme.value },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: colors.value.text },
    },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      center: ['50%', '44%'],
      label: { show: false },
      labelLine: { show: false },
      data: [
        { value: pos, name: t(PAYMENT_METHOD_DISPLAY.pos.labelKey), itemStyle: { color: colors.value.palette[0] } },
        { value: cash, name: t(PAYMENT_METHOD_DISPLAY.cash.labelKey), itemStyle: { color: colors.value.palette[1] } },
        { value: free, name: t(PAYMENT_METHOD_DISPLAY.free.labelKey), itemStyle: { color: colors.value.textSecondary } },
      ],
    }],
  }
})
</script>

<template>
  <div class="bg-elevated rounded-xl border border-default p-4 space-y-2">
    <h3 class="text-sm font-semibold text-muted">{{ t('payments.overview.methodMixChartTitle') }}</h3>
    <BaseChart :option="option" height="16rem" />
  </div>
</template>
