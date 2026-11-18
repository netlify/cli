import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { TokenLocation } from '../../../../src/utils/types.js'

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  isInteractive: vi.fn(),
  log: vi.fn(),
}))

vi.mock('../../../../src/utils/command-helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/command-helpers.js')>()),
  getToken: mocks.getToken,
  log: mocks.log,
  exit: vi.fn(),
}))

vi.mock('../../../../src/utils/scripted-commands.js', () => ({ isInteractive: mocks.isInteractive }))

import { login } from '../../../../src/commands/login/login.js'
import type BaseCommand from '../../../../src/commands/base-command.js'

const TOKEN = 'nfp_secret-token-value'
const command = { setAnalyticsPayload: vi.fn() } as unknown as BaseCommand

const runAlreadyLoggedIn = async (location: TokenLocation, interactive: boolean): Promise<string> => {
  mocks.getToken.mockResolvedValue([TOKEN, location])
  mocks.isInteractive.mockReturnValue(interactive)
  await login({}, command)
  return mocks.log.mock.calls.map((args) => String(args[0] ?? '')).join('\n')
}

describe('login when already logged in', () => {
  beforeEach(() => {
    mocks.log.mockClear()
  })

  test('hints at updating @netlify/mcp for a keychain token in a non-interactive session', async () => {
    const output = await runAlreadyLoggedIn('keychain', false)

    expect(output).toContain("Already logged in via your operating system's keychain")
    expect(output).toContain('@netlify/mcp')
    expect(output).toContain('restart your agent or editor')
    expect(output).not.toContain(TOKEN)
  })

  test('omits the hint in an interactive session', async () => {
    expect(await runAlreadyLoggedIn('keychain', true)).not.toContain('@netlify/mcp')
  })

  test('omits the hint when the token is not in the keychain', async () => {
    expect(await runAlreadyLoggedIn('config', false)).not.toContain('@netlify/mcp')
  })
})
