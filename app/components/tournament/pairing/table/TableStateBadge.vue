<!-- app\components\tournament\pairing\table\TableStateBadge.vue -->
<script setup lang="ts">
defineProps<{ isComplete: boolean }>()

const { t } = useI18n()
</script>

<template>
  <UTooltip
    :content="{ side: 'top' }"
    :text="isComplete ? t('tournament.pairing.complete') : t('tournament.pairing.inProgress')"
  >
    <UBadge
      :color="isComplete ? 'success' : 'warning'"
      :leading-icon="isComplete ? ICONS.confirm : ICONS.clock"
      variant="subtle"
    >
      <span class="hidden @sm:inline whitespace-nowrap">
        {{ isComplete ? t('tournament.pairing.complete') : t('tournament.pairing.inProgress') }}
      </span>
    </UBadge>
  </UTooltip>
</template>
