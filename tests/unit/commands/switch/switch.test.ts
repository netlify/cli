import { beforeEach, describe, expect, test, vi } from 'vitest'

const { logMessages, mockSelect, mockLogin } = vi.hoisted(() => ({
  logMessages: [] as string[],
  mockSelect: vi.fn(),
  mockLogin: vi.fn(),
}))

vi.mock('@inquirer/prompts', () => ({
  select: mockSelect,
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
}))

vi.mock('../../../../src/commands/login/login.js', () => ({
  login: mockLogin,
}))

import { switchCommand } from '../../../../src/commands/switch/switch.js'

const users = {
  'user-1': { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
  'user-2': { id: 'user-2', name: 'Bob', email: 'bob@corp.com' },
}

const createCommand = (usersData = users) => {
  const mockSet = vi.fn()
  const command = {
    netlify: {
      globalConfig: {
        get: vi.fn().mockReturnValue(usersData),
        set: mockSet,
      },
    },
  } as unknown as Parameters<typeof switchCommand>[1]
  return { command, mockSet }
}

describe('switchCommand', () => {
  beforeEach(() => {
    logMessages.length = 0
    vi.clearAllMocks()
  })

  test('--email auto-switches when a match is found', async () => {
    const { command, mockSet } = createCommand()

    await switchCommand({ email: 'alice@example.com' }, command)

    expect(mockSet).toHaveBeenCalledWith('userId', 'user-1')
    expect(logMessages.some((m) => m.includes('Alice'))).toBe(true)
    expect(mockSelect).not.toHaveBeenCalled()
  })

  test('--email falls through to prompt when no match is found', async () => {
    const { command } = createCommand()
    mockSelect.mockResolvedValueOnce('Bob (bob@corp.com)')

    await switchCommand({ email: 'nobody@example.com' }, command)

    expect(logMessages.some((m) => m.includes('No account found matching'))).toBe(true)
    expect(mockSelect).toHaveBeenCalled()
  })

  test('--email does not match partial email strings', async () => {
    const { command } = createCommand()
    mockSelect.mockResolvedValueOnce('Bob (bob@corp.com)')

    await switchCommand({ email: 'bob@corp' }, command)

    expect(logMessages.some((m) => m.includes('No account found matching'))).toBe(true)
    expect(mockSelect).toHaveBeenCalled()
  })

  test('without --email shows interactive prompt', async () => {
    const { command, mockSet } = createCommand()
    mockSelect.mockResolvedValueOnce('Alice (alice@example.com)')

    await switchCommand({}, command)

    expect(mockSelect).toHaveBeenCalled()
    expect(mockSet).toHaveBeenCalledWith('userId', 'user-1')
  })

  test('selecting login new triggers login flow', async () => {
    const { command } = createCommand()
    mockSelect.mockResolvedValueOnce('I would like to login to a new account')

    await switchCommand({}, command)

    expect(mockLogin).toHaveBeenCalledWith({ new: true }, command)
  })
})
