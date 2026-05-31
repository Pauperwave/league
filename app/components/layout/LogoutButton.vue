<!-- app\components\Layout\LogoutButton.vue -->
<!--
  LogoutButton.vue

  Componente per il logout dell'utente.
-->
<script setup lang="ts">
import { useButtonLogging } from '~/composables/useButtonLogging'

const { logout } = usePasswordAuth()

const logoutLogging = useButtonLogging('Logout')

function handleLogout() {
  logoutLogging.logClick()
  logout()
}
</script>

<template>
  <UButton
    icon="i-lucide-log-out"
    color="neutral"
    variant="ghost"
    aria-label="Logout"
    @click="handleLogout"
  />
</template>
