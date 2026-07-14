<!-- app\components\event\EndedEventBadge.vue -->
<!--
  Marks the event page's ended phase, above the final standings
  (see docs/architecture/event-flow.md).
-->
<script setup lang="ts">

const { t } = useI18n()
</script>

<template>
  <div class="text-center py-4">
    <UBadge color="neutral" size="lg" :icon="ICONS.success">
      {{ t('event.endedBadge') }}
    </UBadge>
  </div>
</template>
