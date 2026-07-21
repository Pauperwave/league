// test\nuxt\components\standings\StandingsCard.test.ts
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StandingsCard from '~/components/standings/StandingsCard.vue'
import { defaultStubs, createI18nTestPlugin } from '#test/helpers/mocks'

describe('StandingsCard', () => {
  it('renders title and Inserito badge when provided', () => {
    const wrapper = mount(StandingsCard, {
      props: {
        title: 'Classifica Parziale',
        standings: [{
          standing_id: 1,
          event_id: 1,
          player_id: 1,
          standing_player_score: 10,
          standing_player_rank: 1,
          victories: 0,
          brew_received: 0,
          play_received: 0,
          players: {
            player_id: 1,
            player_name: 'A',
            player_surname: 'B',
            is_active: true,
            formats_played: null,
          },
        }],
        submittedByPlayerId: { 1: true },
      },
      global: {
        stubs: defaultStubs,
        plugins: [createI18nTestPlugin({
          player: { stats: { wins: 'Vittorie', kills: 'Uccisioni' } },
          event: { standingsCard: { brewVotesTooltip: 'Brew votes', playVotesTooltip: 'Play votes', submittedBadge: 'Inserito' } },
        })],
      },
    })

    expect(wrapper.text()).toContain('Classifica Parziale')
    expect(wrapper.text()).toContain('Inserito')
  })
})
