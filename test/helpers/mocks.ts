// test\helpers\mocks.ts
import { vi } from 'vitest'
import { createI18n } from 'vue-i18n'

/**
 * Stubs per componenti Nuxt UI e globali.
 * Da passare come `global.stubs` in mountSuspended/mount.
 */
export const defaultStubs = {
  UButton: {
    name: 'UButton',
    template: '<button v-bind="$attrs"><slot /></button>',
    props: ['color', 'variant', 'size', 'icon', 'loading', 'disabled', 'ariaLabel'],
  },
  UIcon: {
    name: 'UIcon',
    template: '<span class="u-icon" :data-icon="name" />',
    props: ['name'],
  },
  UBadge: {
    name: 'UBadge',
    template: '<span class="u-badge"><slot /></span>',
    props: ['color', 'variant', 'size'],
  },
  ClientOnly: {
    name: 'ClientOnly',
    template: '<slot />',
  },
}

type TestLocaleMessages = { [key: string]: string | TestLocaleMessages }

/**
 * Real vue-i18n plugin for component tests that use useI18n().
 * @vue/test-utils' `mount()` doesn't install Nuxt's real plugin, so
 * useI18n() throws "Need to install with app.use function" without this.
 * Pass only the keys actually used by the component under test —
 * no need to replicate the entire `i18n/i18n.config.ts` tree.
 */
export function createI18nTestPlugin<T extends TestLocaleMessages>(messages: T = {} as T) {
  return createI18n({
    legacy: false,
    locale: 'it',
    messages: { it: messages },
  })
}

/**
 * Base mock for the Supabase client.
 * Each test can extend it with custom vi.fn().
 */
// fallow-ignore-next-line unused-export -- scaffolding for the composables Supabase tests tracked in docs/PROGRESS.md ("Prossimi passi" #6); not called yet
export function createSupabaseMock() {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
}
