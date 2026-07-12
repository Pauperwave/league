<!-- app\components\players\PlayersHeader.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
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
      <UButton color="neutral" :icon="ICONS.back" to="/">
        Home
      </UButton>
      <h1 class="text-2xl font-bold">
        Giocatori
      </h1>
      <UButton :icon="ICONS.addPlayer" color="primary" @click="$emit('createPlayer')">
        Crea Giocatore
      </UButton>
    </div>
  </div>
</template>
