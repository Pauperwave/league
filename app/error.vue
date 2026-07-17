<!-- app\error.vue -->
<script setup lang="ts">
import type { NuxtError } from '#app'

interface Props {
  error: NuxtError
}

const props = defineProps<Props>()

const { t } = useI18n()
const { logClick } = useButtonLogging('error-back-home', { statusCode: () => props.error.statusCode })

const is404 = computed(() => props.error.statusCode === 404)
const title = computed(() => t(is404.value ? 'error.title404' : 'error.titleGeneric'))
const description = computed(() => t(is404.value ? 'error.description404' : 'error.descriptionGeneric'))

async function onBackHome() {
  logClick()
  await clearError({ redirect: '/' })
}
</script>

<template>
  <div class="min-h-screen bg-default flex flex-col items-center justify-center p-6">
    <div class="text-center max-w-md">
      <p class="text-6xl font-bold text-primary mb-4">
        {{ error.statusCode }}
      </p>
      <h1 class="text-2xl font-bold mb-2">
        {{ title }}
      </h1>
      <p class="text-muted mb-8">
        {{ description }}
      </p>
      <UButton
        color="primary"
        size="lg"
        :icon="ICONS.home"
        loading-auto
        @click="onBackHome"
      >
        {{ t('error.backHome') }}
      </UButton>
    </div>
  </div>
</template>
