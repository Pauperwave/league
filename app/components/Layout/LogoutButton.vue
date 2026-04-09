<!--
  LogoutButton.vue

  Componente per il logout dell'utente.
-->
<script setup lang="ts">
const { logout } = usePasswordAuth()
</script>

<template>
  <UButton
    icon="i-lucide-log-out"
    color="neutral"
    variant="ghost"
    aria-label="Logout"
    @click="logout"
  />
</template>
