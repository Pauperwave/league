<!-- app\components\layout\DeveloperOverlayToggle.vue -->
<!--
  DeveloperOverlayToggle.vue

  Toggles just the visual debug overlay (element outlines, heading badges,
  missing-alt/label highlighting — see useDeveloperViewOverlay.ts/main.css)
  on/off, independently of developer mode itself (useDeveloperView.ts). Only
  visible when developer mode is already on — lets quick-fill buttons/the
  action log stay available without the outline overlay being distracting.
-->
<script setup lang="ts">
const { isDeveloperView, isOverlayEnabled } = useDeveloperView()
const { t } = useI18n()

const toggleLogging = useButtonLogging('Toggle Developer Overlay')

function toggle() {
  toggleLogging.logClick()
  isOverlayEnabled.value = !isOverlayEnabled.value
}
</script>

<template>
  <ClientOnly>
    <UTooltip
      v-if="isDeveloperView"
      :content="{ side: 'bottom' }"
      :text="isOverlayEnabled ? t('common.disableDeveloperOverlay') : t('common.enableDeveloperOverlay')"
    >
      <UButton
        :icon="isOverlayEnabled ? ICONS.hide : ICONS.show"
        color="neutral"
        variant="ghost"
        :aria-label="isOverlayEnabled ? t('common.disableDeveloperOverlay') : t('common.enableDeveloperOverlay')"
        @click="toggle"
      />
    </UTooltip>

    <template #fallback>
      <div class="size-8" />
    </template>
  </ClientOnly>
</template>
