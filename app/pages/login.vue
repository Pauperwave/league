<!-- app\pages\login.vue -->
<script setup lang="ts">
import { useButtonLogging } from '~/composables/useButtonLogging'

const { login } = usePasswordAuth()
const route = useRoute()
const toast = useToast()

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
      title: 'Password errata',
      description: 'Riprova',
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
          Accesso Protetto
        </h1>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="handleSubmit"
      >
        <UFormField label="Password">
          <UInput
            v-model="inputPassword"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Inserisci la password"
            leading-icon="i-lucide-lock"
            class="w-full"
          >
            <template #trailing>
              <span class="flex items-center gap-1">
                <UButton
                  v-if="inputPassword"
                  color="neutral"
                  variant="link"
                  size="xs"
                  icon="i-lucide-circle-x"
                  aria-label="Cancella password"
                  @click="handleClearPassword"
                />
                <UButton
                  color="neutral"
                  variant="link"
                  size="xs"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Nascondi password' : 'Mostra password'"
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
          Accedi
        </UButton>
      </form>
    </UCard>
  </div>
</template>
