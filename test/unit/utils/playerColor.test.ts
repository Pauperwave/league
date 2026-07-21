// test\unit\utils\playerColor.test.ts
import { describe, expect, it } from 'vitest'
import { getPlayerColorMap } from '~/utils/playerColor'

describe('getPlayerColorMap', () => {
  it('assigns a stable color per player id, keyed as a string', () => {
    const map = getPlayerColorMap([{ id: 10 }, { id: 20 }])
    expect(map.get('10')).toBe('primary')
    expect(map.get('20')).toBe('secondary')
  })

  it('cycles back to the first color after 6 players', () => {
    const players = Array.from({ length: 7 }, (_, i) => ({ id: i }))
    const map = getPlayerColorMap(players)
    expect(map.get('0')).toBe(map.get('6'))
  })

  it('returns an empty map for no players', () => {
    expect(getPlayerColorMap([]).size).toBe(0)
  })
})
