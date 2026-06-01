<!-- app\components\events\Pairings\TableStateBadge.vue -->
<script setup lang="ts">
defineProps<{ isComplete: boolean }>()
</script>

<template>
  <UBadge
    :color="isComplete ? 'success' : 'warning'"
    :leading-icon="isComplete ? 'i-lucide-check' : 'i-lucide-clock'"
    variant="subtle"
  >
    {{ isComplete ? 'Completato' : 'In corso' }}
  </UBadge>
</template>
