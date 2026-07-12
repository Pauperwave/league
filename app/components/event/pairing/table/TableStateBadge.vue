<!-- app\components\events\Pairings\TableStateBadge.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
defineProps<{ isComplete: boolean }>()

const { t } = useI18n()
</script>

<template>
  <UBadge
    :color="isComplete ? 'success' : 'warning'"
    :leading-icon="isComplete ? ICONS.confirm : ICONS.clock"
    variant="subtle"
  >
    {{ isComplete ? t('event.pairing.complete') : t('event.pairing.inProgress') }}
  </UBadge>
</template>
