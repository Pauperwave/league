<!-- app\components\event\pairing\table\TableStateBadge.vue -->
<script setup lang="ts">
defineProps<{ isComplete: boolean }>()

const { t } = useI18n()
</script>

<template>
  <UTooltip :content="{ side: 'top' }" :text="isComplete ? t('event.pairing.complete') : t('event.pairing.inProgress')">
    <UBadge
      :color="isComplete ? 'success' : 'warning'"
      :leading-icon="isComplete ? ICONS.confirm : ICONS.clock"
      variant="subtle"
    >
      <span class="hidden @sm:inline whitespace-nowrap">{{ isComplete ? t('event.pairing.complete') : t('event.pairing.inProgress') }}</span>
    </UBadge>
  </UTooltip>
</template>
