import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '~/components/ui/BaseButton.vue'
import { defaultStubs, createI18nTestPlugin } from '#test/helpers/mocks'

const i18n = createI18nTestPlugin({ common: { remove: 'Rimuovi' } })

describe('BaseButton', () => {
  it('passa le props corrette per action "remove"', () => {
    const wrapper = mount(BaseButton, {
      props: { action: 'remove' },
      global: { stubs: defaultStubs, plugins: [i18n] },
    })

    const btn = wrapper.findComponent({ name: 'UButton' })
    expect(btn.props('color')).toBe('error')
    expect(btn.props('ariaLabel')).toBe('Rimuovi')
  })

  it('propaga loading e disabled', () => {
    const wrapper = mount(BaseButton, {
      props: { action: 'remove', loading: true, disabled: true },
      global: { stubs: defaultStubs, plugins: [i18n] },
    })

    const btn = wrapper.findComponent({ name: 'UButton' })
    expect(btn.props('loading')).toBe(true)
    expect(btn.props('disabled')).toBe(true)
  })
})
