// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/a11y',
    '@nuxt/hints',
    '@pinia/nuxt',
    '@nuxtjs/supabase',
    '@nuxtjs/robots'
  ],

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        '@internationalized/date',
      ]
    }
  },

  components: [
    // rimuove il prefisso per tutti i componenti
    { path: '~/components', pathPrefix: false }
  ],

  imports: {
    // scansiona ricorsivamente tutte le sottocartelle
    dirs: ['~/composables/**']
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  site: { indexable: false },

  runtimeConfig: {
    // Private (server-only)
    sitePassword: 'Amicizia'
  },

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  robots: {
    disallow: ['/']
  },

  supabase: {
    redirect: false,
    // https://nuxt.com/docs/4.x/api/nuxt-config#alias
    types: '#shared/utils/types/database.ts'
  }
})
