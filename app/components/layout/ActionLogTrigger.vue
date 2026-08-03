<!-- app\components\layout\ActionLogTrigger.vue -->
<!--
  ActionLogTrigger.vue

  Header button that opens ActionLogPanel.vue — the persisted, in-app view of
  every useButtonLogging() click (see useActionLog.ts). Only visible when the
  app-wide developer view (useDeveloperView.ts) is on.
-->
<script setup lang="ts">
const { t } = useI18n()

const isOpen = ref(false)
</script>

<template>
  <DeveloperToolbarButton
    :icon="ICONS.actionLog"
    :button-aria-label="t('actionLogPanel.openAriaLabel')"
    @click="isOpen = true"
  />

  <ActionLogPanel v-model:open="isOpen" />
</template>
