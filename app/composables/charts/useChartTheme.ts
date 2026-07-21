// app\composables\charts\useChartTheme.ts

/**
 * ECharts renders to canvas/SVG with hardcoded colors — it doesn't read
 * Tailwind CSS variables or follow `prefers-color-scheme`, so every chart
 * option must set its own text/tooltip colors explicitly. Centralized here
 * so a chart's own option only supplies data/layout, not theme upkeep.
 */
export function useChartTheme() {
  const colorMode = useColorMode()
  const isDark = computed(() => colorMode.value === 'dark')

  const textColor = computed(() => (isDark.value ? '#e5e7eb' : '#374151'))
  const mutedColor = computed(() => (isDark.value ? '#9ca3af' : '#6b7280'))

  const tooltipTheme = computed(() => ({
    backgroundColor: isDark.value ? '#1f2937' : '#ffffff',
    borderColor: isDark.value ? '#374151' : '#e5e7eb',
    textStyle: { color: textColor.value },
  }))

  return { isDark, textColor, mutedColor, tooltipTheme }
}
