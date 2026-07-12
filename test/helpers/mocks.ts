import { vi } from 'vitest'

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

/**
 * Mock base per il client Supabase.
 * Ogni test può estendere con vi.fn() custom.
 */
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
