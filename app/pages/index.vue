<!-- app\pages\index.vue -->
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
        icon="i-lucide-trophy"
      >
        Vai alle Leghe
      </UButton>

      <div class="mt-4">
        <UButton
          to="/rulesets"
          color="neutral"
          variant="outline"
          size="md"
          icon="i-lucide-scale"
        >
          Vedi Regolamenti
        </UButton>
      </div>
    </div>
  </div>
</template>
