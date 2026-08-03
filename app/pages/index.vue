<!-- app\pages\index.vue -->
<script setup lang="ts">

const { t } = useI18n()

const secondaryLinks = [
  { to: '/players', icon: ICONS.players, labelKey: 'home.allPlayers' },
  { to: '/decks', icon: ICONS.battle, labelKey: 'home.allDecks' },
  { to: '/commanders', icon: ICONS.commander, labelKey: 'home.allCommanders' },
  { to: '/rulesets', icon: ICONS.rules, labelKey: 'home.viewRulesets' },
  { to: '/payments', icon: ICONS.registration, labelKey: 'home.viewPayments' },
]
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
          v-for="link in secondaryLinks"
          :key="link.to"
          :to="link.to"
          color="neutral"
          size="md"
          :icon="link.icon"
        >
          {{ t(link.labelKey) }}
        </UButton>
      </div>
    </div>
  </div>
</template>
