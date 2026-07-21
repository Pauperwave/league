<!-- app\components\layout\HeaderActions.vue -->
<!--
  HeaderActions.vue

  Wrapper component that groups the header actions:
  - Developer view toggle (DeveloperViewToggle)
  - Theme switch (ColorModeSwitch)
  - Logout (LogoutButton)
-->
<script setup lang="ts">
// No logic needed, just composition
</script>

<template>
  <div class="flex items-center gap-2">
    <DeveloperViewToggle />
    <ColorModeSwitch />
    <LogoutButton />
  </div>
</template>
