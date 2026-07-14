<!-- app\components\layout\ColorModeSwitch.vue -->
<!--
  ColorModeSwitch.vue

  Toggles between light and dark theme.
  Uses the useThemeTransition composable to handle the animated theme change.
-->
<script setup lang="ts">
// Get theme state and the toggle function from the composable
const { isDark, toggleTheme } = useThemeTransition()
const { t } = useI18n()
</script>

<template>
  <!-- ClientOnly to avoid server-side rendering of this UI component -->
  <ClientOnly>
    <!--
      Button that swaps icon based on theme:
      - isDark = true  → sun (light theme)
      - isDark = false → moon (dark theme)
    -->
    <UButton
      :icon="isDark ? ICONS.lightMode : ICONS.darkMode"
      color="neutral"
      variant="ghost"
      :aria-label="isDark ? t('common.switchToLightMode') : t('common.switchToDarkMode')"
      @click="toggleTheme"
    />
    <!-- Placeholder while loading server-side -->
    <template #fallback>
      <div class="size-8" />
    </template>
  </ClientOnly>
</template>
