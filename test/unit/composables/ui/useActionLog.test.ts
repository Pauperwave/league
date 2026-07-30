// test\unit\composables\ui\useActionLog.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useActionLog } from '~/composables/ui/useActionLog'

function mountActionLog() {
  let result!: ReturnType<typeof useActionLog>
  const Host = defineComponent({
    setup() {
      result = useActionLog()
      return () => h('div')
    },
  })
  mount(Host)
  return result
}

describe('useActionLog', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('appends and persists an entry', () => {
    const { entries, recordEntry } = mountActionLog()
    recordEntry({ button: 'Test Button', timestamp: '2026-07-30T00:00:00.000Z' })

    expect(entries.value).toHaveLength(1)
    expect(entries.value[0]).toMatchObject({ button: 'Test Button', timestamp: '2026-07-30T00:00:00.000Z' })
    expect(entries.value[0]!.id).toBeTruthy()
  })

  it('omits context when not provided but keeps it when present', () => {
    const { entries, recordEntry } = mountActionLog()
    recordEntry({ button: 'No Context', timestamp: '2026-07-30T00:00:00.000Z' })
    recordEntry({ button: 'With Context', timestamp: '2026-07-30T00:00:01.000Z', context: { foo: 'bar' } })

    expect(entries.value[0]!.context).toBeUndefined()
    expect(entries.value[1]!.context).toEqual({ foo: 'bar' })
  })

  it('trims oldest-first once the cap is exceeded, keeping order', () => {
    const { entries, recordEntry } = mountActionLog()

    for (let i = 0; i < 260; i++) {
      recordEntry({ button: `Button ${i}`, timestamp: `2026-07-30T00:00:${String(i % 60).padStart(2, '0')}.000Z` })
    }

    expect(entries.value).toHaveLength(250)
    expect(entries.value[0]!.button).toBe('Button 10')
    expect(entries.value[entries.value.length - 1]!.button).toBe('Button 259')
  })

  it('clears the log', () => {
    const { entries, recordEntry, clearLog } = mountActionLog()
    recordEntry({ button: 'Test Button', timestamp: '2026-07-30T00:00:00.000Z' })
    expect(entries.value).toHaveLength(1)

    clearLog()
    expect(entries.value).toHaveLength(0)
  })
})
