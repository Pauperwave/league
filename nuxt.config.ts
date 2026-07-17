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
    '@nuxt/test-utils/module',
    '@nuxtjs/i18n',
    '@nuxt/hints',
    'nuxt-auth-utils',
    '@pinia/colada-nuxt'
  ],

  components: [
    // rimuove il prefisso per tutti i componenti
    { path: '~/components', pathPrefix: false }
  ],

  imports: {
    // recursively scans all subfolders
    // KEEP IN SYNC with vitest.config.ts's AutoImport plugin (it mirrors these
    // dirs + the vue/vue-i18n/pinia/@vueuse presets so plain-mount tests get
    // the same auto-imports as the app) — there's a matching comment there.
    dirs: ['~/composables/**']
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  site: { indexable: false },

  runtimeConfig: {
    // Private (server-only). Empty default so the value is read from the
    // NUXT_SITE_PASSWORD env var at runtime (boot), not baked in at build time.
    sitePassword: '',

    // nuxt-auth-utils sealed sessions: the seal secret comes from the
    // NUXT_SESSION_PASSWORD env var (32+ chars, server-only, required in every
    // deploy environment). maxAge matches the old site-auth cookie (1 week).
    session: {
      maxAge: 60 * 60 * 24 * 7
    },

    public: {
      appVersion: process.env.npm_package_version,
      appEnv: process.env.NODE_ENV ?? 'development'
    }
  },

  compatibilityDate: '2026-07-17',

  alias: {
    '#test': '../test'
  },

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
        'valibot',
        'vue',
        'vue-router'
      ]
    },
    // Works around a known Nuxt/Nitro prerender bug where the SSR bundle
    // does a default import from vue's ESM entry, which has no default
    // export: https://github.com/nuxt/nuxt/issues/33132
    ssr: {
      noExternal: ['vue', 'vue-router']
    }
  },

  robots: {
    disallow: ['/']
  },

  supabase: {
    redirect: false,
    // https://nuxt.com/docs/4.x/api/nuxt-config#alias
    types: '#shared/utils/types/database.ts'
  },

  // Single-locale (Italian-only) app — no_prefix means no /it/ URL prefix.
  // Adopted for centralized string management, not for actual multi-language support.
  i18n: {
    locales: [
      { code: 'it', name: 'Italiano', file: 'it.json' }
    ],
    defaultLocale: 'it',
    strategy: 'no_prefix',
    langDir: 'locales/',
    vueI18n: './i18n.config.ts'
  }
})