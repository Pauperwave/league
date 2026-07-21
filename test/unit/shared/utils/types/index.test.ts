// test\unit\shared\utils\types\index.test.ts
import { describe, expect, it } from 'vitest'
import { getPairingPlayerIds } from '#shared/utils/types'
import type { Pairing } from '#shared/utils/types'

function makePairing(overrides: Partial<Pairing> = {}): Pairing {
  return {
    event_id: 1,
    pairing_id: 1,
    pairing_round: 1,
    pairing_datetime: null,
    pairing_is_full: true,
    pairing_player1_id: 1,
    pairing_player2_id: 2,
    pairing_player3_id: 3,
    pairing_player4_id: 4,
    ...overrides,
  }
}

describe('getPairingPlayerIds', () => {
  it('returns all 4 seats for a full table', () => {
    expect(getPairingPlayerIds(makePairing())).toEqual([1, 2, 3, 4])
  })

  it('drops a null 4th seat for a 3-player table', () => {
    expect(getPairingPlayerIds(makePairing({ pairing_player4_id: null }))).toEqual([1, 2, 3])
  })

  it('returns an empty array when no seats are filled', () => {
    const pairing = makePairing({
      pairing_player1_id: null,
      pairing_player2_id: null,
      pairing_player3_id: null,
      pairing_player4_id: null,
    })
    expect(getPairingPlayerIds(pairing)).toEqual([])
  })
})
