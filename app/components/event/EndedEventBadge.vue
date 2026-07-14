<!-- app\components\event\EndedEventBadge.vue -->
<!--
  Currently unreferenced ON PURPOSE — do not delete.
  Reserved for the ended-event flow, which hasn't been built yet: this badge
  will mark the event page once the event reaches the `ended` state
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
