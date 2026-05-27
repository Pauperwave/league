// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/a11y',
    '@pinia/nuxt',
    '@nuxtjs/supabase',
    '@nuxtjs/robots',
    '@vueuse/nuxt',
    '@nuxt/image',
    'motion-v/nuxt',
    'pinia-plugin-persistedstate/nuxt'
  ],

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
    sitePassword: process.env.NUXT_SITE_PASSWORD
  },

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  // Vite configuration to suppress sourcemap warnings
  vite: {
    build: {
      // Disable sourcemaps in production to avoid warnings
      sourcemap: false
    },
    css: {
      // Suppress CSS sourcemap warnings
      devSourcemap: false
    },
    optimizeDeps: {
      include: [
        '@internationalized/date',
        'fast-levenshtein', // CJS
        '@vue-flow/core',
        '@vue-flow/background',
        '@vue-flow/controls',
        'vue-draggable-plus',
        'valibot'
      ]
    }
  },

  robots: {
    disallow: ['/']
  },

  supabase: {
    redirect: false,
    // https://nuxt.com/docs/4.x/api/nuxt-config#alias
    types: '#shared/utils/types/database.ts'
  }
})
