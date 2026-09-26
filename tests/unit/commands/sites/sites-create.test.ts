import { describe, expect, test, vi } from 'vitest'

const { mockPrompt } = vi.hoisted(() => ({
  mockPrompt: vi.fn(),
}))

vi.mock('inquirer', () => ({
  default: { prompt: mockPrompt },
}))

vi.mock('../../../../src/utils/scripted-commands.js', () => ({
  isInteractive: () => true,
}))

vi.mock('../../../../src/utils/telemetry/report-error.js', () => ({
  reportError: vi.fn(),
}))

vi.mock('../../../../src/utils/telemetry/index.js', () => ({
  track: vi.fn(),
}))

vi.mock('../../../../src/commands/link/link.js', () => ({
  link: vi.fn(),
}))

import { sitesCreate } from '../../../../src/commands/sites/sites-create.js'
import type BaseCommand from '../../../../src/commands/base-command.js'

const commandWithAccounts = (accounts: unknown[]) =>
  ({
    authenticate: vi.fn().mockResolvedValue(undefined),
    netlify: {
      accounts,
      api: {},
    },
  }) as unknown as BaseCommand

describe('sitesCreate', () => {
  test('throws a team error instead of opening an empty list prompt', async () => {
    await expect(sitesCreate({}, commandWithAccounts([]))).rejects.toThrowError(/No teams available/)
    expect(mockPrompt).not.toHaveBeenCalled()
  })
})
