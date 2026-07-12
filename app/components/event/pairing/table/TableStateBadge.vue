<!-- app\components\events\Pairings\TableStateBadge.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
defineProps<{ isComplete: boolean }>()
</script>

<template>
  <UBadge
    :color="isComplete ? 'success' : 'warning'"
    :leading-icon="isComplete ? ICONS.confirm : ICONS.clock"
    variant="subtle"
  >
    {{ isComplete ? 'Completato' : 'In corso' }}
  </UBadge>
</template>
