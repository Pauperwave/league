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
const { isOverlayEnabled } = useDeveloperView()
const { t } = useI18n()

const toggleLogging = useButtonLogging(t('logging.developerView.toggleOverlay'))

function toggle() {
  toggleLogging.logClick()
  isOverlayEnabled.value = !isOverlayEnabled.value
}

const ariaLabel = computed(() => isOverlayEnabled.value
  ? t('common.disableDeveloperOverlay')
  : t('common.enableDeveloperOverlay'))
</script>

<template>
  <DeveloperToolbarButton
    :icon="isOverlayEnabled ? ICONS.hide : ICONS.show"
    :button-aria-label="ariaLabel"
    @click="toggle"
  />
</template>
