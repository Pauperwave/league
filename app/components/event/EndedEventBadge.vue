<!-- app\components\Events\EndedEventBadge.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'

const { t } = useI18n()
</script>

<template>
  <div class="text-center py-4">
    <UBadge color="neutral" size="lg" :icon="ICONS.success">
      {{ t('event.endedBadge') }}
    </UBadge>
  </div>
</template>
