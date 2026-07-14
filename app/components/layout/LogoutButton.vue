<!-- app\components\layout\LogoutButton.vue -->
<!--
  LogoutButton.vue

  Componente per il logout dell'utente.
-->
<script setup lang="ts">

const { logout } = usePasswordAuth()
const { t } = useI18n()

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
    :aria-label="t('common.logout')"
    @click="handleLogout"
  />
</template>
