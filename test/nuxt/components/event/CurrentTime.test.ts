// test\nuxt\components\event\CurrentTime.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CurrentTime from '~/components/event/CurrentTime.vue'
import { defaultStubs } from '#test/helpers/mocks'

describe('CurrentTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the current time as HH:mm', () => {
    vi.setSystemTime(new Date(2026, 6, 14, 15, 42, 0))

    const wrapper = mount(CurrentTime, {
      global: { stubs: defaultStubs },
    })

    expect(wrapper.text()).toContain('15:42')
  })

  it('ticks forward as time passes', async () => {
    vi.setSystemTime(new Date(2026, 6, 14, 15, 42, 59))

    const wrapper = mount(CurrentTime, {
      global: { stubs: defaultStubs },
    })
    expect(wrapper.text()).toContain('15:42')

    vi.advanceTimersByTime(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('15:43')
  })

  it('renders the clock icon', () => {
    vi.setSystemTime(new Date(2026, 6, 14, 12, 0, 0))

    const wrapper = mount(CurrentTime, {
      global: { stubs: defaultStubs },
    })

    expect(wrapper.find('.u-icon').exists()).toBe(true)
  })
})
