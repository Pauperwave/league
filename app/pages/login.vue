<!-- app\pages\login.vue -->
<script setup lang="ts">

const { login } = usePasswordAuth()
const route = useRoute()
const toast = useToast()
const { t } = useI18n()

const inputPassword = ref('')
const showPassword = ref(false)

const redirectPath = computed(() => {
  const redirect = route.query.redirect as string
  return redirect || '/'
})

const submitLogging = useButtonLogging('Login Submit', { redirectPath: () => redirectPath.value })
const clearPasswordLogging = useButtonLogging('Clear Password')
const togglePasswordLogging = useButtonLogging('Toggle Password', { showPassword: () => !showPassword.value })

async function handleSubmit() {
  submitLogging.logClick()
  if (await login(inputPassword.value)) {
    navigateTo(redirectPath.value)
  } else {
    toast.add({
      title: t('login.wrongPasswordTitle'),
      description: t('login.wrongPasswordDescription'),
      color: 'error'
    })
  }
}

function handleClearPassword() {
  clearPasswordLogging.logClick()
  inputPassword.value = ''
}

function handleTogglePassword() {
  togglePasswordLogging.logClick()
  showPassword.value = !showPassword.value
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-center text-xl font-bold">
          {{ t('login.title') }}
        </h1>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="handleSubmit"
      >
        <UFormField :label="t('login.passwordLabel')">
          <UInput
            v-model="inputPassword"
            :type="showPassword ? 'text' : 'password'"
            :placeholder="t('login.passwordPlaceholder')"
            :leading-icon="ICONS.lock"
            class="w-full"
          >
            <template #trailing>
              <span class="flex items-center gap-1">
                <UButton
                  v-if="inputPassword"
                  color="neutral"
                  variant="link"
                  size="xs"
                  :icon="ICONS.clear"
                  :aria-label="t('login.clearPasswordAriaLabel')"
                  @click="handleClearPassword"
                />
                <UButton
                  color="neutral"
                  variant="link"
                  size="xs"
                  :icon="showPassword ? ICONS.hide : ICONS.show"
                  :aria-label="showPassword ? t('login.hidePasswordAriaLabel') : t('login.showPasswordAriaLabel')"
                  @click="handleTogglePassword"
                />
              </span>
            </template>
          </UInput>
        </UFormField>

        <UButton
          block
          type="submit"
          :disabled="!inputPassword"
        >
          {{ t('login.submitButton') }}
        </UButton>
      </form>
    </UCard>
  </div>
</template>
