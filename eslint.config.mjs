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
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],

      // Destructuring with 4+ properties goes multiline (e.g. `const {
      // a, b, c, d } = defineProps<...>()`) — short 2-3 property destructures
      // (`const { data, error } = useX()`) stay on one line regardless of length.
      // Scoped to ObjectPattern only (destructuring) — object-property-newline
      // can't be scoped the same way, it'd also force every object *literal*
      // multiline, so "one property per line" within the wrap is manual/review,
      // not autofixed.
      '@stylistic/object-curly-newline': ['error', {
        ObjectPattern: { minProperties: 4, multiline: true, consistent: true }
      }],

      // 100 chars — tighter than the previous 120 cap, tuned after review of
      // what was actually running long. ignoreUrls/Strings/TemplateLiterals:
      // a long i18n key shouldn't force an awkward wrap just to hit a number.
      // ignoreComments: JSDoc/comment lines aren't code and don't benefit
      // from mid-sentence wraps. ignorePattern for `class="..."`: Tailwind
      // strings are left as-is rather than broken — line-wrapping a class
      // list doesn't improve readability the way wrapping code does. Inline
      // object-literal return types (`(): { a: string, b: number } => ...`)
      // are NOT exempted — the intended fix there is extracting a named
      // type, not wrapping the line (see CLAUDE.md).
      '@stylistic/max-len': ['error', {
        code: 100,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
        ignoreComments: true,
        ignorePattern: 'class\\s*=\\s*"'
      }],

      // Vue template lines with more than 3 bound attrs/directives wrap one
      // per line — keeps wide component tags scannable instead of one long
      // attribute soup.
      'vue/max-attributes-per-line': ['error', {
        singleline: { max: 3 },
        multiline: { max: 1 }
      }],

      // 2-space indent, enforced — added after a manual max-len wrap fix
      // shipped with broken indentation that nothing caught (see PROGRESS.md
      // 2026-08-03). @stylistic/indent covers <script> content in both .ts
      // and .vue files; vue/html-indent covers the <template> block, which
      // @stylistic/indent doesn't parse. SwitchCase: 1 matches this
      // codebase's existing one-level-deeper `case` convention.
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      'vue/html-indent': ['error', 2],

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
    // shared/utils/types/database.ts is generated (`npx supabase gen types
    // ...`), not hand-maintained — don't lint formatting that will just be
    // regenerated away.
    ignores: ['node_modules/**', 'shared/utils/types/database.ts']
  }
)
