<!-- app\components\ui\actions\QuickFillButton.vue -->
<!--
  A single dev-only "fill with test data" trigger. Renders nothing unless the
  app-wide developer view (useDeveloperView.ts) is on — callers don't need to
  gate visibility themselves. Centralized here specifically so every
  quick-fill button (single table, fill-all, and any future one) shares the
  same icon/color/variant instead of drifting apart across call sites.
-->
<script setup lang="ts">
const { tooltip, ariaLabel, size = 'xs' } = defineProps<{
  tooltip: string
  /** Defaults to `tooltip` when not given. */
  ariaLabel?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>()

const emit = defineEmits<{
  click: []
}>()

const { isDeveloperView } = useDeveloperView()
</script>

<template>
  <UTooltip v-if="isDeveloperView" :content="{ side: 'top' }" :text="tooltip">
    <UButton
      :size="size"
      variant="outline"
      color="warning"
      :icon="ICONS.quickAction"
      :aria-label="ariaLabel ?? tooltip"
      @click="emit('click')"
    />
  </UTooltip>
</template>
