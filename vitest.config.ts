import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const _dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    // Mirror of Nuxt's auto-imports so plain @vue/test-utils mounts get the
    // same compile-time import injection as the real app (source files rely on
    // auto-imports — see CLAUDE.md). KEEP IN SYNC with nuxt.config.ts
    // (`imports.dirs` + the modules' presets) — matching comment there.
    // Nuxt *runtime* composables (useToast, useSupabaseClient, useAsyncData,
    // useRoute, ...) are NOT covered — they need a running Nuxt app; tests
    // must stub/mock those per test.
    AutoImport({
      imports: ['vue', 'vue-i18n', 'pinia', '@vueuse/core'],
      dirs: ['./app/composables/**', './app/utils', './app/stores'],
      // Values referenced only in <template> (e.g. ICONS) compile to _ctx
      // lookups — vueTemplate covers those too, like Nuxt does.
      vueTemplate: true,
      dts: false,
    }),
  ],
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '~': resolve(_dirname, 'app'),
      '~/app': resolve(_dirname, 'app'),
      '#test': resolve(_dirname, 'test'),
      '#shared': resolve(_dirname, 'shared'),
    },
  },
})
