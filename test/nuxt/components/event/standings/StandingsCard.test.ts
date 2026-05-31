import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StandingsCard from '~/components/event/standings/StandingsCard.vue'
import { defaultStubs } from '#test/helpers/mocks'

describe('StandingsCard', () => {
  it('renders title and Inserito badge when provided', () => {
    const wrapper = mount(StandingsCard, {
      props: {
        title: 'Classifica Parziale',
        standings: [{
          player_id: 1,
          standing_player_score: 10,
          victories: 0,
          players: { player_name: 'A', player_surname: 'B' },
        }],
        submittedByPlayerId: { 1: true },
      },
      global: {
        stubs: defaultStubs,
      },
    })

    expect(wrapper.text()).toContain('Classifica Parziale')
    expect(wrapper.text()).toContain('Inserito')
  })
})
