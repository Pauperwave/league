<!-- app\app.vue -->
<script setup>
import { it } from '@nuxt/ui/locale'

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'it'
  }
})

const title = 'Gestione Lega'
const description = 'Gestione leghe Magic: The Gathering Commander: eventi, abbinamenti, punteggi e classifiche.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
})
</script>

<template>
  <UApp :locale="it" class="h-screen flex flex-col">
    <!-- <UHeader class="shrink-0">
      <template #left>
        <NuxtLink to="/">
          <AppLogo class="w-auto h-6 shrink-0" />
        </NuxtLink>
      </template>

      <template #right>
        <HeaderActions />
      </template>
    </UHeader> -->

    <UMain class="flex-1 overflow-hidden">
      <NuxtPage />
    </UMain>
  </UApp>
</template>
