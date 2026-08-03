<!-- app\components\layout\DeveloperViewToggle.vue -->
<!--
  DeveloperViewToggle.vue

  Toggles the app-wide "developer view" (see useDeveloperView.ts) — shows/hides
  dev-only test-data helpers (quick-fill buttons, etc.) scattered across the app.
-->
<script setup lang="ts">
// Hardcoded on purpose — this isn't a real auth boundary (the app already
// sits behind the site-wide session password), just a speed bump so an
// event organizer's screen isn't one accidental click away from exposing
// dev-only test-data helpers to whoever is standing nearby.
const DEVELOPER_VIEW_PASSWORD = 'test'

const { isDeveloperView } = useDeveloperView()
const { t } = useI18n()

const toggleLogging = useButtonLogging(t('logging.developerView.toggle'))

const showPasswordPopover = ref(false)
const password = ref('')
const passwordError = ref(false)

function disable() {
  toggleLogging.logClick()
  isDeveloperView.value = false
}

function openPasswordPopover() {
  toggleLogging.logClick()
  password.value = ''
  passwordError.value = false
  showPasswordPopover.value = true
}

function confirmPassword() {
  if (password.value !== DEVELOPER_VIEW_PASSWORD) {
    passwordError.value = true
    return
  }
  isDeveloperView.value = true
  showPasswordPopover.value = false
}
</script>

<template>
  <ClientOnly>
    <UTooltip
      v-if="isDeveloperView"
      :content="{ side: 'bottom' }"
      :text="t('common.disableDeveloperView')"
    >
      <UButton
        :icon="ICONS.terminal"
        color="warning"
        variant="soft"
        :aria-label="t('common.disableDeveloperView')"
        @click="disable"
      />
    </UTooltip>

    <UPopover v-else v-model:open="showPasswordPopover">
      <UButton
        :icon="ICONS.terminal"
        color="neutral"
        variant="ghost"
        :aria-label="t('common.enableDeveloperView')"
        @click="openPasswordPopover"
      />

      <template #content>
        <div class="p-3 flex flex-col gap-2 w-56">
          <p class="text-sm font-medium">{{ t('common.developerViewPasswordDescription') }}</p>
          <UInput
            v-model="password"
            type="password"
            :placeholder="t('common.developerViewPasswordPlaceholder')"
            autofocus
            @keyup.enter="confirmPassword"
          />
          <p v-if="passwordError" class="text-error text-xs">{{ t('common.developerViewPasswordError') }}</p>
          <UButton block @click="confirmPassword">
            {{ t('common.developerViewPasswordConfirm') }}
          </UButton>
        </div>
      </template>
    </UPopover>

    <template #fallback>
      <div class="size-8" />
    </template>
  </ClientOnly>
</template>
