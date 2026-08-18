import { describe, expect, test, vi, beforeEach } from 'vitest'

const {
  mockResetDatabase,
  mockCleanup,
  mockConnectToDatabase,
  mockExecutor,
  mockRm,
  mockPrompt,
  mockIsInteractive,
  logMessages,
  jsonMessages,
} = vi.hoisted(() => {
  const mockResetDatabase = vi.fn().mockResolvedValue(undefined)
  const mockCleanup = vi.fn().mockResolvedValue(undefined)
  const mockExecutor = {}
  const mockConnectToDatabase = vi.fn()
  const mockRm = vi.fn().mockResolvedValue(undefined)
  const mockPrompt = vi.fn()
  const mockIsInteractive = vi.fn().mockReturnValue(true)
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  return {
    mockResetDatabase,
    mockCleanup,
    mockConnectToDatabase,
    mockExecutor,
    mockRm,
    mockPrompt,
    mockIsInteractive,
    logMessages,
    jsonMessages,
  }
})

vi.mock('@netlify/dev', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  resetDatabase: (...args: unknown[]) => mockResetDatabase(...args),
}))

vi.mock('../../../../src/commands/database/util/db-connection.js', async () => ({
  ...(await vi.importActual('../../../../src/commands/database/util/db-connection.js')),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  connectToDatabase: (...args: unknown[]) => mockConnectToDatabase(...args),
}))

vi.mock('fs/promises', async () => ({
  ...(await vi.importActual('fs/promises')),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  rm: (...args: unknown[]) => mockRm(...args),
}))

vi.mock('inquirer', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  default: { prompt: (...args: unknown[]) => mockPrompt(...args) },
}))

vi.mock('../../../../src/utils/scripted-commands.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  isInteractive: () => mockIsInteractive(),
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
  logJson: (message: unknown) => {
    jsonMessages.push(message)
  },
}))

import { reset } from '../../../../src/commands/database/db-reset.js'
import { LocalDatabaseStartError } from '../../../../src/commands/database/util/db-connection.js'

function createMockCommand(overrides: { buildDir?: string; projectRoot?: string } = {}) {
  const { buildDir = '/project', projectRoot = '/project' } = overrides

  return {
    project: { root: projectRoot, baseDirectory: undefined },
    netlify: {
      site: { root: buildDir },
      config: {},
    },
  } as unknown as Parameters<typeof reset>[1]
}

describe('reset', () => {
  beforeEach(() => {
    logMessages.length = 0
    jsonMessages.length = 0
    vi.clearAllMocks()
    mockResetDatabase.mockResolvedValue(undefined)
    mockIsInteractive.mockReturnValue(true)
    mockRm.mockResolvedValue(undefined)
    mockConnectToDatabase.mockResolvedValue({ executor: mockExecutor, cleanup: mockCleanup })
  })

  test('resets the database and calls cleanup', async () => {
    await reset({}, createMockCommand())

    expect(mockResetDatabase).toHaveBeenCalledWith(mockExecutor)
    expect(mockCleanup).toHaveBeenCalledOnce()
  })

  test('logs success message after reset', async () => {
    await reset({}, createMockCommand())

    expect(logMessages).toContain('Local development database has been reset.')
  })

  test('outputs JSON when --json flag is set', async () => {
    await reset({ json: true }, createMockCommand())

    expect(jsonMessages).toHaveLength(1)
    expect(jsonMessages[0]).toEqual({ reset: true })
  })

  test('calls cleanup even when reset throws', async () => {
    mockResetDatabase.mockRejectedValueOnce(new Error('reset failed'))

    await expect(reset({}, createMockCommand())).rejects.toThrow('reset failed')

    expect(mockCleanup).toHaveBeenCalledOnce()
  })

  test('throws when project root cannot be determined', async () => {
    const command = {
      project: { root: undefined, baseDirectory: undefined },
      netlify: { site: { root: undefined }, config: {} },
    } as unknown as Parameters<typeof reset>[1]

    await expect(reset({}, command)).rejects.toThrow('Could not determine the project root directory.')
  })

  describe('when the local database cannot be started', () => {
    const DB_DIRECTORY = '/project/.netlify/db'
    const PGLITE_ABORT = 'Failed to start Netlify Database locally: RuntimeError: Aborted().'

    beforeEach(() => {
      mockConnectToDatabase.mockRejectedValue(new LocalDatabaseStartError(DB_DIRECTORY, [PGLITE_ABORT]))
    })

    test('discards the data directory once the user confirms', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true })

      await reset({}, createMockCommand())

      expect(mockRm).toHaveBeenCalledWith(DB_DIRECTORY, { recursive: true, force: true })
    })

    test('explains the underlying startup failure before prompting', async () => {
      mockPrompt.mockResolvedValue({ confirmed: true })

      await reset({}, createMockCommand())

      expect(logMessages.join('\n')).toContain(PGLITE_ABORT)
    })

    test('keeps the data directory when the user declines', async () => {
      mockPrompt.mockResolvedValue({ confirmed: false })

      await reset({}, createMockCommand())

      expect(mockRm).not.toHaveBeenCalled()
      expect(logMessages).toContain('Reset cancelled.')
    })

    test('discards without prompting when --force is set', async () => {
      await reset({ force: true }, createMockCommand())

      expect(mockPrompt).not.toHaveBeenCalled()
      expect(mockRm).toHaveBeenCalledWith(DB_DIRECTORY, { recursive: true, force: true })
    })

    test('outputs JSON when --json and --force are set', async () => {
      await reset({ force: true, json: true }, createMockCommand())

      expect(jsonMessages).toEqual([{ reset: true, discarded: true }])
    })

    test('refuses to prompt in a non-interactive shell and points at --force', async () => {
      mockIsInteractive.mockReturnValue(false)

      await expect(reset({}, createMockCommand())).rejects.toThrow('--force')

      expect(mockRm).not.toHaveBeenCalled()
    })

    test('refuses to prompt when --json is set without --force', async () => {
      await expect(reset({ json: true }, createMockCommand())).rejects.toThrow('--force')

      expect(mockPrompt).not.toHaveBeenCalled()
      expect(mockRm).not.toHaveBeenCalled()
    })

    test('never resets logically when the database could not start', async () => {
      await reset({ force: true }, createMockCommand())

      expect(mockResetDatabase).not.toHaveBeenCalled()
    })
  })

  test('propagates connection errors that are not local startup failures', async () => {
    mockConnectToDatabase.mockRejectedValue(new Error('password authentication failed'))

    await expect(reset({}, createMockCommand())).rejects.toThrow('password authentication failed')

    expect(mockRm).not.toHaveBeenCalled()
  })
})
