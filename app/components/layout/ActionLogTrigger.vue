<!-- app\components\layout\ActionLogTrigger.vue -->
<!--
  ActionLogTrigger.vue

  Header button that opens ActionLogPanel.vue — the persisted, in-app view of
  every useButtonLogging() click (see useActionLog.ts). Only visible when the
  app-wide developer view (useDeveloperView.ts) is on.
-->
<script setup lang="ts">
const { isDeveloperView } = useDeveloperView()
const { t } = useI18n()

const isOpen = ref(false)
</script>

<template>
  <ClientOnly>
    <UTooltip
      v-if="isDeveloperView"
      :content="{ side: 'bottom' }"
      :text="t('actionLogPanel.openAriaLabel')"
    >
      <UButton
        :icon="ICONS.actionLog"
        color="neutral"
        variant="ghost"
        :aria-label="t('actionLogPanel.openAriaLabel')"
        @click="isOpen = true"
      />
    </UTooltip>

    <template #fallback>
      <div class="size-8" />
    </template>
  </ClientOnly>

  <ActionLogPanel v-model:open="isOpen" />
</template>
