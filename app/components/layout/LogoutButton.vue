<!-- app\components\Layout\LogoutButton.vue -->
<!--
  LogoutButton.vue

  Componente per il logout dell'utente.
-->
<script setup lang="ts">
import { ICONS } from '~/utils/icons'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

const { logout } = usePasswordAuth()

const logoutLogging = useButtonLogging('Logout')

function handleLogout() {
  logoutLogging.logClick()
  logout()
}
</script>

<template>
  <UButton
    :icon="ICONS.logout"
    color="neutral"
    variant="ghost"
    aria-label="Logout"
    @click="handleLogout"
  />
</template>
