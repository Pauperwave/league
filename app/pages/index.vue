<!-- app\pages\index.vue -->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
</script>

<template>
  <div class="min-h-screen bg-default flex flex-col items-center justify-center p-6">
    <div class="text-center">
      <h1 class="text-4xl font-bold mb-4">
        PauperWave League Manager
      </h1>
      <p class="text-lg text-muted mb-8">
        Gestisci le tue leghe e tornei di Commander
      </p>
      <UButton
        to="/leagues"
        color="primary"
        size="lg"
        :icon="ICONS.standings"
      >
        Vai alle Leghe
      </UButton>

      <div class="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
        <UButton
          to="/players"
          color="neutral"
          size="md"
          :icon="ICONS.players"
        >
          Tutti i Giocatori
        </UButton>
        <UButton
          to="/decks"
          color="neutral"
          size="md"
          :icon="ICONS.battle"
        >
          Tutti i Deck
        </UButton>
        <UButton
          to="/rulesets"
          color="neutral"
          size="md"
          :icon="ICONS.rules"
        >
          Vedi Regolamenti
        </UButton>
      </div>
    </div>
  </div>
</template>
