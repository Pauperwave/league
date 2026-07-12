<!-- app\components\Events\EndedEventBadge.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
</script>

<template>
  <div class="text-center py-4">
    <UBadge color="neutral" size="lg" :icon="ICONS.success">
      Evento Terminato
    </UBadge>
  </div>
</template>
