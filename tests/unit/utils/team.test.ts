import { describe, expect, test, vi } from 'vitest'

vi.mock('../../../src/utils/telemetry/report-error.js', () => ({
  reportError: vi.fn(),
}))

import { requireTeams, resolveTeam, resolveTeamForNonInteractive } from '../../../src/utils/team.js'
import type { MinimalAccount } from '../../../src/utils/types.js'

const team = (overrides: Partial<MinimalAccount> = {}): MinimalAccount => ({
  id: 'acc-1',
  name: 'Acme',
  slug: 'acme',
  default: false,
  team_logo_url: null,
  on_pro_trial: false,
  organization_id: null,
  type_name: 'Pro',
  type_slug: 'pro',
  members_count: 1,
  ...overrides,
})

describe('requireTeams', () => {
  test('throws when the account list is empty', () => {
    expect(() => requireTeams([])).toThrowError(/No teams available/)
  })

  test('throws when the account list is missing', () => {
    expect(() => requireTeams(undefined)).toThrowError(/No teams available/)
  })

  test('returns the account list when at least one team exists', () => {
    const accounts = [team()]
    expect(requireTeams(accounts)).toBe(accounts)
  })
})

describe('resolveTeam', () => {
  test('returns the only team', () => {
    const only = team()
    expect(resolveTeam([only])).toBe(only)
  })

  test('returns the default team when several exist', () => {
    const fallback = team({ id: 'acc-2', slug: 'other', name: 'Other' })
    const preferred = team({ default: true })
    expect(resolveTeam([fallback, preferred])).toBe(preferred)
  })
})

describe('resolveTeamForNonInteractive', () => {
  test('throws when no teams can be selected', () => {
    expect(() => resolveTeamForNonInteractive([], 'netlify sites:create --account-slug <TEAM_SLUG>')).toThrowError(
      /No teams available/,
    )
  })
})
