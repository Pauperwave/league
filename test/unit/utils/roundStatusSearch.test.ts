// test\unit\utils\roundStatusSearch.test.ts
import { describe, expect, it } from 'vitest'
import { matchesRoundStatusFilter, matchesRoundStatusSearch, tableSearchLabel } from '~/utils/roundStatusSearch'

describe('matchesRoundStatusFilter', () => {
  it('always matches under "all"', () => {
    expect(matchesRoundStatusFilter(true, 'all')).toBe(true)
    expect(matchesRoundStatusFilter(false, 'all')).toBe(true)
  })

  it('matches only done items under "done"', () => {
    expect(matchesRoundStatusFilter(true, 'done')).toBe(true)
    expect(matchesRoundStatusFilter(false, 'done')).toBe(false)
  })

  it('matches only not-done items under "pending"', () => {
    expect(matchesRoundStatusFilter(false, 'pending')).toBe(true)
    expect(matchesRoundStatusFilter(true, 'pending')).toBe(false)
  })

  it('"inProgress" collapses to the same predicate as "pending" (no realtime signal yet)', () => {
    expect(matchesRoundStatusFilter(false, 'inProgress')).toBe(true)
    expect(matchesRoundStatusFilter(true, 'inProgress')).toBe(false)
  })
})

describe('matchesRoundStatusSearch', () => {
  it('matches everything when the query is empty or whitespace', () => {
    expect(matchesRoundStatusSearch('Alessandro Berti', '')).toBe(true)
    expect(matchesRoundStatusSearch('Alessandro Berti', '   ')).toBe(true)
  })

  it('matches case-insensitively as a substring', () => {
    expect(matchesRoundStatusSearch('Alessandro Berti', 'berti')).toBe(true)
    expect(matchesRoundStatusSearch('Alessandro Berti', 'BERTI')).toBe(true)
  })

  it('does not match when the query is not a substring', () => {
    expect(matchesRoundStatusSearch('Alessandro Berti', 'toldo')).toBe(false)
  })
})

describe('tableSearchLabel', () => {
  it('combines the bare number and the translated heading', () => {
    expect(tableSearchLabel(1, 'Tavolo 1')).toBe('1 Tavolo 1')
  })

  it('lets a bare-number search match via matchesRoundStatusSearch', () => {
    const haystack = tableSearchLabel(3, 'Tavolo 3')
    expect(matchesRoundStatusSearch(haystack, '3')).toBe(true)
  })

  it('lets a "Tavolo N" search match via matchesRoundStatusSearch', () => {
    const haystack = tableSearchLabel(3, 'Tavolo 3')
    expect(matchesRoundStatusSearch(haystack, 'tavolo 3')).toBe(true)
  })
})
