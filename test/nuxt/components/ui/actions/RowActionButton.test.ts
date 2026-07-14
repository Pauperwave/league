// test\nuxt\components\ui\actions\RowActionButton.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RowActionButton from '~/components/ui/actions/RowActionButton.vue'
import { defaultStubs, createI18nTestPlugin } from '#test/helpers/mocks'

const i18n = createI18nTestPlugin({ common: { remove: 'Rimuovi' } })

describe('RowActionButton', () => {
  it('passa le props corrette per action "remove"', () => {
    const wrapper = mount(RowActionButton, {
      props: { action: 'remove' },
      global: { stubs: defaultStubs, plugins: [i18n] },
    })

    const btn = wrapper.findComponent({ name: 'UButton' })
    expect(btn.props('color')).toBe('error')
    expect(btn.props('ariaLabel')).toBe('Rimuovi')
  })

  it('propaga loading e disabled', () => {
    const wrapper = mount(RowActionButton, {
      props: { action: 'remove', loading: true, disabled: true },
      global: { stubs: defaultStubs, plugins: [i18n] },
    })

    const btn = wrapper.findComponent({ name: 'UButton' })
    expect(btn.props('loading')).toBe(true)
    expect(btn.props('disabled')).toBe(true)
  })
})
