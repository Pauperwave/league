<!-- app\components\layout\LogoutButton.vue -->
<!--
  LogoutButton.vue

  Componente per il logout dell'utente.
-->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ICONS } from '~/utils/icons'
import { useButtonLogging } from '~/composables/ui/useButtonLogging'

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
