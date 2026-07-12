// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import stylistic from '@stylistic/eslint-plugin'

export default withNuxt(
  {
    plugins: {
      '@stylistic': stylistic
    }
  },
  {
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off',

      // General
      'eqeqeq': ['error', 'always'],
      'no-debugger': 'error',

      // Style
      '@stylistic/semi': ['error', 'never'],
      'vue/multi-word-component-names': 'off',

      // Optional props are typed with `?` and default via destructuring
      // (Vue 3.5 reactive props destructure); this rule predates that
      // pattern and misfires even when a default is present.
      'vue/require-default-prop': 'off'
    }
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    ignores: ['node_modules/**']
  }
)
