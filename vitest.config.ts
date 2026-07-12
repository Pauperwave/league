import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const _dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
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
    },
  },
})
