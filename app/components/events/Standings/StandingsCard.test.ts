import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StandingsCard from './StandingsCard.vue'

describe('StandingsCard', () => {
  it('renders title and Inserito badge when provided', () => {
    const wrapper = mount(StandingsCard, {
      props: {
        title: 'Classifica Parziale',
        standings: [{
          player_id: 1,
          standing_player_score: 10,
          players: { player_name: 'A', player_surname: 'B' },
        }],
        submittedByPlayerId: { 1: true },
      },
      global: { stubs: { ClientOnly: true, UIcon: true, UBadge: true } },
    })

    expect(wrapper.text()).toContain('Classifica Parziale')
    expect(wrapper.text()).toContain('Inserito')
  })
})
