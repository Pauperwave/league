// test\unit\stores\events.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { useEventStore } from '~/stores/events'
import { createI18nTestPlugin } from '#test/helpers/mocks'

// BACKLOG #13: none of the lifecycle actions (startEvent/nextRound/turnBackRound)
// guard against being called again while already in flight — a double-click or
// a retried request could fire the same mutation twice. This guards at the
// store level (loadingCount-backed `loading`), independent of any UI disabling.

function setupEventStore() {
  let result!: ReturnType<typeof useEventStore>
  mount(defineComponent({
    setup() {
      result = useEventStore()
      return () => h('div')
    },
  }), {
    global: {
      plugins: [createPinia(), createI18nTestPlugin()],
    },
  })
  return result
}

describe('useEventStore — re-entrancy guard (BACKLOG #13)', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn())
  })

  it('nextRound: a second call while the first is still in flight is rejected without hitting the network again', async () => {
    let resolveFirst!: (value: unknown) => void
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFirst = resolve }))
    vi.stubGlobal('$fetch', fetchMock)

    const store = setupEventStore()

    const firstCall = store.nextRound(1, 1)
    const secondResult = await store.nextRound(1, 1)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(secondResult.success).toBe(false)

    resolveFirst({ event: { event_current_round: 2 }, hasEnded: false })
    await firstCall
  })

  it('startEvent: a second call while the first is still in flight is rejected without hitting the network again', async () => {
    let resolveFirst!: (value: unknown) => void
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFirst = resolve }))
    vi.stubGlobal('$fetch', fetchMock)

    const store = setupEventStore()

    const firstCall = store.startEvent(1, [1, 2, 3, 4])
    const secondResult = await store.startEvent(1, [1, 2, 3, 4])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(secondResult.success).toBe(false)

    resolveFirst({ event: {} })
    await firstCall
  })

  it('turnBackRound: a second call while the first is still in flight is rejected without hitting the network again', async () => {
    let resolveFirst!: (value: unknown) => void
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFirst = resolve }))
    vi.stubGlobal('$fetch', fetchMock)

    const store = setupEventStore()

    const firstCall = store.turnBackRound(1, 2)
    const secondResult = await store.turnBackRound(1, 2)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(secondResult.success).toBe(false)

    resolveFirst({ event: { event_current_round: 1 } })
    await firstCall
  })

  it('allows a fresh call once the previous one has completed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ event: { event_current_round: 2 }, hasEnded: false })
    vi.stubGlobal('$fetch', fetchMock)

    const store = setupEventStore()

    const first = await store.nextRound(1, 1)
    const second = await store.nextRound(1, 2)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
  })
})
