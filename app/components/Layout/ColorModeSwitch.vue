<!--
  ColorModeSwitch.vue

  Componente per alternare tra tema chiaro e scuro.
  Usa il composable useThemeTransition per gestire il cambio tema con animazione.
-->
<script setup lang="ts">
// Recupera lo stato del tema e la funzione di toggle dal composable
const { isDark, toggleTheme } = useThemeTransition()
</script>

<template>
  <!-- ClientOnly per evitare rendering lato server del componente UI -->
  <ClientOnly>
    <!--
      Pulsante che cambia icona in base al tema:
      - isDark = true  → sole (tema chiaro)
      - isDark = false → luna (tema scuro)
    -->
    <UButton
      :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
      color="neutral"
      variant="ghost"
      :aria-label="`Switch to ${isDark ? 'light' : 'dark'} mode`"
      @click="toggleTheme"
    />
    <!-- Placeholder durante il caricamento lato server -->
    <template #fallback>
      <div class="size-8" />
    </template>
  </ClientOnly>
</template>
