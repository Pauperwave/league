<!-- app\components\layout\DeveloperViewToggle.vue -->
<!--
  DeveloperViewToggle.vue

  Toggles the app-wide "developer view" (see useDeveloperView.ts) — shows/hides
  dev-only test-data helpers (quick-fill buttons, etc.) scattered across the app.
-->
<script setup lang="ts">
const { isDeveloperView } = useDeveloperView()
const { t } = useI18n()

const toggleLogging = useButtonLogging('Toggle Developer View')

function toggle() {
  toggleLogging.logClick()
  isDeveloperView.value = !isDeveloperView.value
}
</script>

<template>
  <ClientOnly>
    <UTooltip :content="{ side: 'bottom' }" :text="isDeveloperView ? t('common.disableDeveloperView') : t('common.enableDeveloperView')">
      <UButton
        :icon="ICONS.terminal"
        :color="isDeveloperView ? 'warning' : 'neutral'"
        :variant="isDeveloperView ? 'soft' : 'ghost'"
        :aria-label="isDeveloperView ? t('common.disableDeveloperView') : t('common.enableDeveloperView')"
        @click="toggle"
      />
    </UTooltip>
    <template #fallback>
      <div class="size-8" />
    </template>
  </ClientOnly>
</template>
