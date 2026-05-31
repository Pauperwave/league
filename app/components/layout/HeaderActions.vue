<!-- app\components\Layout\HeaderActions.vue -->
<!--
  HeaderActions.vue

  Componente wrapper che raggruppa le azioni dell'header:
  - Cambio tema (ColorModeSwitch)
  - Logout (LogoutButton)
-->
<script setup lang="ts">
// Nessuna logica necessaria, solo composizione
</script>

<template>
  <div class="flex items-center gap-2">
    <ColorModeSwitch />
    <LogoutButton />
  </div>
</template>
