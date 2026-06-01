<!-- app\components\players\PlayersHeader.vue -->
<script setup lang="ts">
defineEmits<{ createPlayer: [] }>()

const breadcrumbItems = [
  { label: 'Home', to: '/' },
  { label: 'Giocatori' }
]
</script>

<template>
  <div class="space-y-4">
    <UBreadcrumb :items="breadcrumbItems" />
    <div class="flex items-center justify-between">
      <UButton color="neutral" icon="i-lucide-arrow-left" to="/">
        Home
      </UButton>
      <h1 class="text-2xl font-bold">
        Giocatori
      </h1>
      <UButton icon="i-lucide-user-plus" color="primary" @click="$emit('createPlayer')">
        Crea Giocatore
      </UButton>
    </div>
  </div>
</template>
