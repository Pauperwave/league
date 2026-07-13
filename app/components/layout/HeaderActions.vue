<!-- app\components\layout\HeaderActions.vue -->
<!--
  HeaderActions.vue

  Wrapper component that groups the header actions:
  - Theme switch (ColorModeSwitch)
  - Logout (LogoutButton)
-->
<script setup lang="ts">
// No logic needed, just composition
</script>

<template>
  <div class="flex items-center gap-2">
    <ColorModeSwitch />
    <LogoutButton />
  </div>
</template>
