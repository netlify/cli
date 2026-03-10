import { describe, expect, test, vi, beforeEach } from 'vitest'

const { mockResetDatabase, mockCleanup, mockExecutor, logMessages, jsonMessages } = vi.hoisted(() => {
  const mockResetDatabase = vi.fn().mockResolvedValue(undefined)
  const mockCleanup = vi.fn().mockResolvedValue(undefined)
  const mockExecutor = {}
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  return { mockResetDatabase, mockCleanup, mockExecutor, logMessages, jsonMessages }
})

vi.mock('@netlify/db-dev', () => ({
  resetDatabase: (...args: unknown[]) => mockResetDatabase(...args),
}))

vi.mock('../../../../src/commands/database/db-connection.js', () => ({
  connectToDatabase: vi.fn().mockImplementation(() =>
    Promise.resolve({
      executor: mockExecutor,
      cleanup: mockCleanup,
    }),
  ),
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

import { reset } from '../../../../src/commands/database/reset.js'

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
})
