// app\composables\charts\useChartTheme.ts

/**
 * ECharts renders to canvas/SVG with hardcoded colors — it doesn't read
 * Tailwind CSS variables or follow `prefers-color-scheme`, so every chart
 * option must set its own text/tooltip/series colors explicitly. Centralized
 * here so a chart's own option only supplies data/layout, not theme upkeep.
 */
export interface ChartThemeColors {
  text: string
  textSecondary: string
  axisLine: string
  splitLine: string
  tooltipBackground: string
  tooltipBorder: string
  /** 8-slot categorical palette, fixed order — never cycle/reassign per filter. Same reference instance used in the blog project's useChartTheme.ts. */
  palette: string[]
}

const LIGHT_PALETTE = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834']
const DARK_PALETTE = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926']

export function useChartTheme() {
  const colorMode = useColorMode()
  const isDark = computed(() => colorMode.value === 'dark')

  const colors = computed<ChartThemeColors>(() => isDark.value
    ? {
        text: '#e5e7eb',
        textSecondary: '#9ca3af',
        axisLine: '#374151',
        splitLine: '#1f2937',
        tooltipBackground: '#1f2937',
        tooltipBorder: '#374151',
        palette: DARK_PALETTE,
      }
    : {
        text: '#374151',
        textSecondary: '#6b7280',
        axisLine: '#d1d5db',
        splitLine: '#e5e7eb',
        tooltipBackground: '#ffffff',
        tooltipBorder: '#e5e7eb',
        palette: LIGHT_PALETTE,
      })

  const tooltipTheme = computed(() => ({
    backgroundColor: colors.value.tooltipBackground,
    borderColor: colors.value.tooltipBorder,
    textStyle: { color: colors.value.text },
  }))

  return { isDark, colors, tooltipTheme }
}
