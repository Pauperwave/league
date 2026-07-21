<!-- app\pages\index.vue -->
<script setup lang="ts">

const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen bg-default flex flex-col items-center justify-center p-6">
    <div class="text-center">
      <h1 class="text-4xl font-bold mb-4">
        {{ t('home.title') }}
      </h1>
      <p class="text-lg text-muted mb-8">
        {{ t('home.subtitle') }}
      </p>
      <UButton
        to="/leagues"
        color="primary"
        size="lg"
        :icon="ICONS.standings"
      >
        {{ t('home.goToLeagues') }}
      </UButton>

      <div class="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
        <UButton
          to="/players"
          color="neutral"
          size="md"
          :icon="ICONS.players"
        >
          {{ t('home.allPlayers') }}
        </UButton>
        <UButton
          to="/decks"
          color="neutral"
          size="md"
          :icon="ICONS.battle"
        >
          {{ t('home.allDecks') }}
        </UButton>
        <UButton
          to="/commanders"
          color="neutral"
          size="md"
          :icon="ICONS.commander"
        >
          {{ t('home.allCommanders') }}
        </UButton>
        <UButton
          to="/rulesets"
          color="neutral"
          size="md"
          :icon="ICONS.rules"
        >
          {{ t('home.viewRulesets') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
